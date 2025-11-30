import {
  createDbWithAdapter,
  DbResult,
  AdapterBase,
  ColumnSchemaConfig,
  emptyArray,
  MaybeArray,
  pathToLog,
  QueryLogOptions,
  toArray,
} from 'pqb';
import { queryLock, RakeDbCtx, transaction } from '../common';
import {
  clearChanges,
  getCurrentChanges,
  MigrationChange,
} from '../migration/change';
import {
  createMigrationInterface,
  CreateMigrationInterfaceConfig,
  SilentQueries,
} from '../migration/migration';
import {
  getMigratedVersionsMap,
  NoMigrationsTableError,
  deleteMigratedVersion,
  saveMigratedVersion,
  RakeDbAppliedVersions,
} from '../migration/manageMigratedVersions';
import { RakeDbError } from '../errors';
import {
  PickAfterChangeCommit,
  PickBasePath,
  PickForceDefaultExports,
  PickImport,
  PickMigrationCallbacks,
  PickMigrationId,
  PickMigrationsPath,
  PickMigrationsTable,
  PickTransactionSetting,
  RakeDbConfig,
} from '../config';
import path from 'path';
import { createMigrationsTable } from '../migration/migrationsTable';
import {
  getMigrations,
  MigrationItem,
  MigrationItemHasLoad,
  MigrationsSet,
} from '../migration/migrationsSet';
import { versionToString } from '../migration/migration.utils';

export const RAKE_DB_LOCK_KEY = '8582141715823621641';

export interface MigrateFnConfig
  extends MigrateOrRollbackConfig,
    PickAfterChangeCommit,
    PickBasePath,
    PickImport,
    PickMigrationsPath,
    PickTransactionSetting {}

interface MigrateFnParams {
  ctx?: RakeDbCtx;
  adapter: AdapterBase;
  config: MigrateFnConfig;
  count?: number;
  force?: boolean;
}

type MigrateFn = (params: MigrateFnParams) => Promise<void>;

const transactionIfSingle = (
  params: MigrateFnParams,
  fn: (trx: AdapterBase) => Promise<void>,
) => {
  return params.config.transaction === 'single'
    ? transaction(params.adapter, fn)
    : fn(params.adapter);
};

function makeMigrateFn(
  up: boolean,
  fn: (
    trx: AdapterBase,
    config: MigrateFnConfig,
    set: MigrationsSet,
    versions: RakeDbAppliedVersions,
    count: number,
    force: boolean,
  ) => Promise<MigrationItem[]>,
): MigrateFn {
  return async (params): Promise<void> => {
    const ctx = params.ctx || {};
    const set = await getMigrations(ctx, params.config, up);
    const count = params.count ?? Infinity;
    const force = params.force ?? false;

    let migrations: MigrationItem[] | undefined;
    try {
      await transactionIfSingle(params, async (trx) => {
        const versions = await getMigratedVersionsMap(
          ctx,
          trx,
          params.config,
          set.renameTo,
        );

        migrations = await fn(trx, params.config, set, versions, count, force);
      });
    } catch (err) {
      if (err instanceof NoMigrationsTableError) {
        await transactionIfSingle(params, async (trx) => {
          await createMigrationsTable(trx, params.config);

          const versions = await getMigratedVersionsMap(
            ctx,
            trx,
            params.config,
            set.renameTo,
          );

          migrations = await fn(
            trx,
            params.config,
            set,
            versions,
            count,
            force,
          );
        });
      } else {
        throw err;
      }
    }

    params.config.afterChangeCommit?.({
      adapter: params.adapter,
      up,
      migrations: migrations as MigrationItem[],
    });
  };
}

type MigrateCommand = (
  adapters: AdapterBase[],
  config: RakeDbConfig<ColumnSchemaConfig>,
  args: string[],
) => Promise<void>;

const makeMigrateCommand = (
  migrateFn: MigrateFn,
  defaultCount: number,
): MigrateCommand => {
  return async (adapters, config, args) => {
    const arg = args[0];
    let force = arg === 'force';
    let count = defaultCount;
    if (arg === 'force') {
      force = true;
    } else {
      force = false;
      const num = arg === 'all' ? Infinity : parseInt(arg || '');
      if (!isNaN(num)) {
        count = num;
      }
    }

    for (const adapter of adapters) {
      await migrateFn({ ctx: {}, adapter, config, count, force });
    }
  };
};

/**
 * Will run all pending yet migrations, sequentially in order,
 * will apply `change` functions top-to-bottom.
 *
 * @param options - options to construct db adapter with
 * @param config - specifies how to load migrations, callbacks, and logger
 * @param args - pass none or `all` to run all migrations, pass int for how many to migrate
 */
export const migrate: MigrateFn = makeMigrateFn(
  true,
  (trx, config, set, versions, count, force) =>
    migrateOrRollback(trx, config, set, versions, count, true, false, force),
);

export const migrateAndClose: MigrateFn = async (params) => {
  await migrate(params);
  await params.adapter.close();
};

export const migrateCommand = makeMigrateCommand(migrate, Infinity);

/**
 * Will roll back one latest applied migration,
 * will apply `change` functions bottom-to-top.
 *
 * Takes the same options as {@link migrate}.
 */
export const rollback: MigrateFn = makeMigrateFn(
  false,
  (trx, config, set, versions, count, force) =>
    migrateOrRollback(trx, config, set, versions, count, false, false, force),
);

export const rollbackCommand = makeMigrateCommand(rollback, 1);

/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Takes the same options as {@link migrate}.
 */
export const redo: MigrateFn = makeMigrateFn(
  true,
  async (trx, config, set, versions, count, force) => {
    set.migrations.reverse();

    await migrateOrRollback(trx, config, set, versions, count, false, true);

    set.migrations.reverse();

    return migrateOrRollback(
      trx,
      config,
      set,
      versions,
      count,
      true,
      true,
      force,
      true,
    );
  },
);

export const redoCommand = makeMigrateCommand(redo, 1);

const getDb = (adapter: AdapterBase) =>
  createDbWithAdapter<ColumnSchemaConfig>({ adapter });

interface MigrateOrRollbackConfig
  extends PickMigrationCallbacks,
    PickMigrationId,
    QueryLogOptions,
    PickForceDefaultExports,
    PickMigrationsTable,
    PickTransactionSetting {
  columnTypes: unknown;
}

export const migrateOrRollback = async (
  trx: AdapterBase,
  config: MigrateOrRollbackConfig,
  set: MigrationsSet,
  versions: RakeDbAppliedVersions,
  count: number,
  up: boolean,
  redo: boolean,
  force?: boolean,
  skipLock?: boolean,
): Promise<MigrationItem[]> => {
  const { sequence, map: versionsMap } = versions;

  if (up) {
    const rollbackTo = checkMigrationOrder(config, set, versions, force);

    if (rollbackTo) {
      let i = sequence.length - 1;
      for (; i >= 0; i--) {
        if (rollbackTo >= sequence[i]) {
          i++;
          break;
        }
      }
      if (i < 0) i = 0;

      set.migrations.reverse();

      await migrateOrRollback(
        trx,
        config,
        set,
        versions,
        sequence.length - i,
        false,
        redo,
      );

      set.migrations.reverse();
    }
  }

  if (!skipLock) await queryLock(trx);

  let db: DbResult<unknown> | undefined;

  const beforeMigrate = config[up ? 'beforeMigrate' : 'beforeRollback'];
  if (beforeMigrate || config.beforeChange) {
    db ??= getDb(trx);
    const { migrations } = set;
    await beforeMigrate?.({ db, migrations });
    await config.beforeChange?.({ db, migrations, up, redo });
  }

  let loggedAboutStarting = false;

  let migrations: MigrationItem[] | undefined;

  const migrationRunner =
    config.transaction === 'single'
      ? runMigration
      : runMigrationInOwnTransaction;

  for (const file of set.migrations) {
    if (
      (up && versionsMap[file.version]) ||
      (!up && !versionsMap[file.version])
    ) {
      continue;
    }

    if (count-- <= 0) break;

    if (!loggedAboutStarting && (!redo || !up)) {
      loggedAboutStarting = true;
      config.logger?.log(
        `${
          redo ? 'Reapplying migrations for' : up ? 'Migrating' : 'Rolling back'
        } database ${trx.getDatabase()}\n`,
      );
    }

    const changes = await getChanges(file, config);
    const adapter = await migrationRunner(trx, up, changes, config);
    await changeMigratedVersion(adapter, up, file, config);

    (migrations ??= []).push(file);

    if (up) {
      const name = path.basename(file.path);
      versionsMap[file.version] = name;
      sequence.push(+file.version);
    } else {
      versionsMap[file.version] = undefined;
      sequence.pop();
    }

    config.logger?.log(
      `${up ? 'Migrated' : 'Rolled back'} ${pathToLog(file.path)}\n`,
    );
  }

  migrations ??= emptyArray;

  const afterMigrate = config[up ? 'afterMigrate' : 'afterRollback'];
  if (config.afterChange || afterMigrate) {
    db ??= getDb(trx);
    await config.afterChange?.({ db, up, redo, migrations });
    await afterMigrate?.({ db, migrations });
  }

  return migrations;
};

const checkMigrationOrder = (
  config: PickMigrationId,
  set: MigrationsSet,
  { sequence, map }: RakeDbAppliedVersions,
  force?: boolean,
) => {
  if (config.migrationId !== 'timestamp') {
    let prev: MigrationItem = set.migrations[0];
    for (let i = 1; i < set.migrations.length; i++) {
      const file = set.migrations[i];

      const version = +file.version;
      const prevVersion = +prev.version;
      if (version === prevVersion) {
        throw new Error(
          `Found migrations with the same number: ${prev.path} and ${file.path}`,
        );
      } else if (version - prevVersion > 1) {
        throw new Error(
          `There is a gap between migrations ${prev.path} and ${file.path}`,
        );
      }

      prev = file;
    }
  }

  const last = sequence[sequence.length - 1];
  if (last) {
    for (const file of set.migrations) {
      const version = +file.version;
      if (version > last || map[file.version]) continue;

      if (!force) {
        throw new Error(
          `Cannot migrate ${path.basename(
            file.path,
          )} because the higher position ${
            map[versionToString(config, last)]
          } was already migrated.\nRun \`**db command** up force\` to rollback the above migrations and migrate all`,
        );
      }

      return version;
    }
  }
  return;
};

// Cache `change` functions of migrations. Key is a migration file name, value is array of `change` functions.
// When migrating two or more databases, files are loaded just once due to this cache.
export const changeCache: Record<string, MigrationChange[] | undefined> = {};

export const getChanges = async (
  file: MigrationItemHasLoad,
  config?: PickForceDefaultExports,
): Promise<MigrationChange[]> => {
  clearChanges();

  let changes = file.path ? changeCache[file.path] : undefined;
  if (!changes) {
    const module = (await file.load()) as
      | {
          default?: MaybeArray<MigrationChange>;
        }
      | undefined;

    const exported = module?.default && toArray(module.default);

    if (config?.forceDefaultExports && !exported) {
      throw new RakeDbError(
        `Missing a default export in ${file.path} migration`,
      );
    }

    changes = exported || getCurrentChanges();
    if (file.path) changeCache[file.path] = changes;
  }

  return changes;
};

export const runMigrationInOwnTransaction: typeof runMigration = (
  adapter,
  ...rest
) => {
  return transaction(adapter, (trx) => runMigration(trx, ...rest));
};

/**
 * Process one migration file.
 * It performs a db transaction, loads `change` functions from a file, executes them in order specified by `up` parameter.
 * After calling `change` functions successfully, will save new entry or delete one in case of `up: false` from the migrations table.
 */
export const runMigration = async <CT>(
  trx: AdapterBase,
  up: boolean,
  changes: MigrationChange[],
  config: CreateMigrationInterfaceConfig<CT>,
): Promise<SilentQueries> => {
  const db = createMigrationInterface<CT>(trx, up, config);

  if (changes.length) {
    // when up: for (let i = 0; i !== changes.length - 1; i++)
    // when down: for (let i = changes.length - 1; i !== -1; i--)
    const from = up ? 0 : changes.length - 1;
    const to = up ? changes.length : -1;
    const step = up ? 1 : -1;
    for (let i = from; i !== to; i += step) {
      await changes[i].fn(db, up);
    }
  }

  return db.adapter;
};

const changeMigratedVersion = async (
  adapter: SilentQueries,
  up: boolean,
  file: MigrationItem,
  config: PickMigrationsTable,
) => {
  await (up ? saveMigratedVersion : deleteMigratedVersion)(
    adapter,
    file.version,
    path.basename(file.path).slice(file.version.length + 1),
    config,
  );
};
