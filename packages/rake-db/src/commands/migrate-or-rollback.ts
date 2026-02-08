import {
  AdapterBase,
  ColumnSchemaConfig,
  createDbWithAdapter,
  DbResult,
  emptyArray,
  MaybeArray,
  MaybePromise,
  pathToLog,
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
  SilentQueries,
} from '../migration/migration';
import {
  createMigrationsSchemaAndTable,
  deleteMigratedVersion,
  getMigratedVersionsMap,
  NoMigrationsTableError,
  RakeDbAppliedVersions,
  saveMigratedVersion,
} from '../migration/manage-migrated-versions';
import { RakeDbError } from '../errors';
import { RakeDbConfig } from '../config';
import path from 'path';
import {
  getMigrations,
  MigrationItem,
  MigrationItemHasLoad,
  MigrationsSet,
} from '../migration/migrations-set';
import { versionToString } from '../migration/migration.utils';
import {
  DbParam,
  ensureTransaction,
  getMaybeTransactionAdapter,
} from '../utils';

export interface MigrateFnParams {
  ctx?: RakeDbCtx;
  count?: number;
  force?: boolean;
}

export interface MigrateFn {
  (db: DbParam, config: RakeDbConfig, params?: MigrateFnParams): Promise<void>;
}

// runs in transaction only if the adapter is not already in transaction and the `transaction` config is 'single'
const transactionIfSingle = (
  adapter: AdapterBase,
  config: RakeDbConfig,
  fn: (trx: AdapterBase) => Promise<void>,
) => {
  return !adapter.isInTransaction() && config.transaction === 'single'
    ? transaction(adapter, fn)
    : fn(adapter);
};

function makeMigrateFn(
  up: boolean,
  defaultCount: number,
  fn: (
    trx: AdapterBase,
    config: RakeDbConfig,
    set: MigrationsSet,
    versions: RakeDbAppliedVersions,
    count: number,
    force: boolean,
  ) => Promise<MigrationItem[]>,
): MigrateFn {
  return async (db, config, params): Promise<void> => {
    const ctx = params?.ctx || {};
    const set = await getMigrations(ctx, config, up);
    const count = params?.count ?? defaultCount;
    const force = params?.force ?? false;
    const adapter = getMaybeTransactionAdapter(db);

    let migrations: MigrationItem[] | undefined;
    try {
      await transactionIfSingle(adapter, config, async (trx) => {
        const versions = await getMigratedVersionsMap(
          ctx,
          trx,
          config,
          set.renameTo,
        );

        migrations = await fn(trx, config, set, versions, count, force);
      });
    } catch (err) {
      if (err instanceof NoMigrationsTableError) {
        await transactionIfSingle(adapter, config, async (trx) => {
          await createMigrationsSchemaAndTable(trx, config);

          const versions = await getMigratedVersionsMap(
            ctx,
            trx,
            config,
            set.renameTo,
          );

          migrations = await fn(trx, config, set, versions, count, force);
        });
      } else {
        throw err;
      }
    }

    config.afterChangeCommit?.({
      adapter,
      up,
      migrations: migrations as MigrationItem[],
    });
  };
}

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
  Infinity,
  (trx, config, set, versions, count, force) =>
    migrateOrRollback(trx, config, set, versions, count, true, false, force),
);

export const migrateAndClose: MigrateFn = async (db, config, params) => {
  const adapter = getMaybeTransactionAdapter(db);
  await migrate(adapter, config, params);
  await adapter.close();
};

export const runMigration = async (
  db: DbParam,
  migration: () => MaybePromise<unknown>,
) => {
  await ensureTransaction(db, async (trx) => {
    clearChanges();
    const changes = await getChanges({ load: migration });
    const config = changes[0]?.config;

    await applyMigration(trx, true, changes, config);
  });
};

/**
 * Will roll back one latest applied migration,
 * will apply `change` functions bottom-to-top.
 *
 * Takes the same options as {@link migrate}.
 */
export const rollback: MigrateFn = makeMigrateFn(
  false,
  1,
  (trx, config, set, versions, count, force) =>
    migrateOrRollback(trx, config, set, versions, count, false, false, force),
);

/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Takes the same options as {@link migrate}.
 */
export const redo: MigrateFn = makeMigrateFn(
  true,
  1,
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

const getDb = (adapter: AdapterBase) =>
  createDbWithAdapter<ColumnSchemaConfig>({ adapter });

export const migrateOrRollback = async (
  trx: AdapterBase,
  config: RakeDbConfig,
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
    trx.isInTransaction() || config.transaction === 'single'
      ? applyMigration
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
  config: Pick<RakeDbConfig, 'migrationId'>,
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
  config?: Pick<RakeDbConfig, 'forceDefaultExports'>,
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

export const runMigrationInOwnTransaction: typeof applyMigration = (
  adapter,
  ...rest
) => {
  return transaction(adapter, (trx) => applyMigration(trx, ...rest));
};

/**
 * Process one migration file.
 * It performs a db transaction, loads `change` functions from a file, executes them in order specified by `up` parameter.
 * After calling `change` functions successfully, will save new entry or delete one in case of `up: false` from the migrations table.
 */
export const applyMigration = async (
  trx: AdapterBase,
  up: boolean,
  changes: MigrationChange[],
  config: Pick<RakeDbConfig, 'log' | 'logger' | 'columnTypes'>,
): Promise<SilentQueries> => {
  const db = createMigrationInterface(trx, up, config);

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
  config: Pick<RakeDbConfig, 'migrationsTable'>,
) => {
  await (up ? saveMigratedVersion : deleteMigratedVersion)(
    adapter,
    file.version,
    path.basename(file.path).slice(file.version.length + 1),
    config,
  );
};
