import {
  Adapter,
  AdapterOptions,
  createDb,
  DbResult,
  TransactionAdapter,
} from 'pqb';
import {
  ColumnSchemaConfig,
  MaybeArray,
  pathToLog,
  toArray,
} from 'orchid-core';
import { queryLock, RakeDbCtx, transaction } from '../common';
import {
  ChangeCallback,
  clearChanges,
  getCurrentChanges,
} from '../migration/change';
import {
  createMigrationInterface,
  RakeDbColumnTypes,
} from '../migration/migration';
import {
  getMigratedVersionsMap,
  NoMigrationsTableError,
  deleteMigratedVersion,
  saveMigratedVersion,
  RakeDbAppliedVersions,
} from '../migration/manageMigratedVersions';
import { RakeDbError } from '../errors';
import { RakeDbAst } from '../ast';
import { AnyRakeDbConfig, AppCodeUpdater, RakeDbConfig } from '../config';
import path from 'path';
import { createMigrationsTable } from '../migration/migrationsTable';
import {
  getMigrations,
  MigrationItem,
  MigrationsSet,
} from '../migration/migrationsSet';
import { versionToString } from '../migration/migrationUtils';

export const RAKE_DB_LOCK_KEY = '8582141715823621641';

type MigrateFn = <
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  ctx: RakeDbCtx,
  options: AdapterOptions[],
  config: RakeDbConfig<SchemaConfig, CT>,
  args?: string[],
  dontClose?: boolean,
) => Promise<Adapter[]>;

function makeMigrateFn<
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  defaultCount: number,
  up: boolean,
  fn: (
    trx: TransactionAdapter,
    config: RakeDbConfig<SchemaConfig, CT>,
    set: MigrationsSet,
    versions: RakeDbAppliedVersions,
    count: number,
    asts: RakeDbAst[],
    force: boolean,
  ) => Promise<void>,
): MigrateFn {
  return async (
    ctx: RakeDbCtx,
    options,
    config,
    args = [],
    dontClose,
  ): Promise<Adapter[]> => {
    const set = await getMigrations(ctx, config, up);

    const arg = args[0];
    let force = arg === 'force';
    let count: number | undefined;
    if (arg === 'force') {
      force = true;
    } else {
      force = false;
      const num = arg === 'all' ? Infinity : parseInt(arg);
      count = isNaN(num) ? undefined : num;
    }

    const conf = prepareConfig(config, args, count === undefined || force);
    const asts: RakeDbAst[] = [];
    const appCodeUpdaterCache = {};
    const { appCodeUpdater } = conf;
    let localAsts = asts;
    const length = options.length;
    const adapters = new Array<Adapter>(length);
    for (let i = 0; i < length; i++) {
      const opts = options[i];
      const adapter = (adapters[i] = new Adapter(opts));

      try {
        await transaction(adapter, async (trx) => {
          const versions = await getMigratedVersionsMap(
            ctx,
            trx,
            config,
            set.renameTo,
          );

          await fn(
            trx,
            conf as unknown as RakeDbConfig<SchemaConfig, CT>,
            set,
            versions,
            count ?? defaultCount,
            localAsts,
            force,
          );
        });
      } catch (err) {
        if (err instanceof NoMigrationsTableError) {
          await transaction(adapter, async (trx) => {
            const config = conf as unknown as RakeDbConfig<SchemaConfig, CT>;

            await createMigrationsTable(trx, config);

            const versions = await getMigratedVersionsMap(
              ctx,
              trx,
              config,
              set.renameTo,
            );

            await fn(
              trx,
              config,
              set,
              versions,
              count ?? defaultCount,
              localAsts,
              force,
            );
          });
        } else {
          throw err;
        }
      } finally {
        if (!dontClose) await adapter.close();
      }

      // ignore asts after the first db was migrated
      localAsts = [];

      config.afterChangeCommit?.({
        options: opts,
        up,
        migrations: set.migrations,
      });
    }

    await runCodeUpdaterAfterAll(
      options[0],
      config,
      appCodeUpdater,
      asts,
      appCodeUpdaterCache,
    );

    return adapters;
  };
}

/**
 * Will run all pending yet migrations, sequentially in order,
 * will apply `change` functions top-to-bottom.
 *
 * @param options - options to construct db adapter with
 * @param config - specifies how to load migrations, may have `appCodeUpdater`, callbacks, and logger.
 * @param args - pass none or `all` to run all migrations, pass int for how many to migrate, `--code` to enable and `--code false` to disable `useCodeUpdater`.
 */
export const migrate: MigrateFn = makeMigrateFn(
  Infinity,
  true,
  (trx, config, set, versions, count, asts, force) =>
    migrateOrRollback(
      trx,
      config,
      set,
      versions,
      count,
      asts,
      true,
      false,
      force,
    ),
);

/**
 * Will roll back one latest applied migration,
 * will apply `change` functions bottom-to-top.
 *
 * Takes the same options as {@link migrate}.
 */
export const rollback: MigrateFn = makeMigrateFn(
  1,
  false,
  (trx, config, set, versions, count, asts, force) =>
    migrateOrRollback(
      trx,
      config,
      set,
      versions,
      count,
      asts,
      false,
      false,
      force,
    ),
);

/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Takes the same options as {@link migrate}.
 */
export const redo: MigrateFn = makeMigrateFn(
  1,
  true,
  async (trx, config, set, versions, count, asts, force) => {
    set.migrations.reverse();

    await migrateOrRollback(
      trx,
      config,
      set,
      versions,
      count,
      asts,
      false,
      true,
    );

    set.migrations.reverse();

    await migrateOrRollback(
      trx,
      config,
      set,
      versions,
      count,
      asts,
      true,
      true,
      force,
      true,
    );
  },
);

const getDb = (adapter: Adapter) =>
  createDb<ColumnSchemaConfig, RakeDbColumnTypes>({ adapter });

function prepareConfig<SchemaConfig extends ColumnSchemaConfig, CT>(
  config: RakeDbConfig<SchemaConfig, CT>,
  args: string[],
  hasArg: boolean,
): RakeDbConfig<SchemaConfig, CT> {
  config = { ...config };

  const i = hasArg ? 0 : 1;
  const arg = args[i];
  if (arg === '--code') {
    config.useCodeUpdater = args[i + 1] !== 'false';
  }

  if (!config.useCodeUpdater) delete config.appCodeUpdater;
  return config;
}

export const migrateOrRollback = async (
  trx: TransactionAdapter,
  config: RakeDbConfig<ColumnSchemaConfig, RakeDbColumnTypes>,
  set: MigrationsSet,
  versions: RakeDbAppliedVersions,
  count: number,
  asts: RakeDbAst[],
  up: boolean,
  redo: boolean,
  force?: boolean,
  skipLock?: boolean,
): Promise<void> => {
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
        asts,
        false,
        redo,
      );

      set.migrations.reverse();
    }
  }

  if (!skipLock) await queryLock(trx);

  let db: DbResult<RakeDbColumnTypes> | undefined;

  const beforeMigrate = config[up ? 'beforeMigrate' : 'beforeRollback'];
  if (beforeMigrate || config.beforeChange) {
    db ??= getDb(trx);
    const { migrations } = set;
    await beforeMigrate?.({ db, migrations });
    await config.beforeChange?.({ db, migrations, up, redo });
  }

  for (const file of set.migrations) {
    if (
      (up && versionsMap[file.version]) ||
      (!up && !versionsMap[file.version])
    ) {
      continue;
    }

    if (count-- <= 0) break;

    await runMigration(trx, up, file, config, asts);

    if (up) {
      const name = path.basename(file.path);
      versionsMap[file.version] = name;
      sequence.push(+file.version);
    } else {
      versionsMap[file.version] = undefined;
      sequence.pop();
    }

    config.logger?.log(
      `${up ? 'Migrated' : 'Rolled back'} ${pathToLog(file.path)}`,
    );
  }

  const afterMigrate = config[up ? 'afterMigrate' : 'afterRollback'];
  if (config.afterChange || afterMigrate) {
    db ??= getDb(trx);
    const { migrations } = set;
    await config.afterChange?.({ db, up, redo, migrations });
    await afterMigrate?.({ db, migrations });
  }
};

const checkMigrationOrder = (
  config: AnyRakeDbConfig,
  set: MigrationsSet,
  { sequence, map }: RakeDbAppliedVersions,
  force?: boolean,
) => {
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

async function runCodeUpdaterAfterAll<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  options: AdapterOptions,
  config: RakeDbConfig<SchemaConfig, CT>,
  appCodeUpdater: AppCodeUpdater | undefined,
  asts: RakeDbAst[],
  cache: object,
) {
  for (const ast of asts) {
    await appCodeUpdater?.process({
      ast,
      options,
      basePath: config.basePath,
      cache,
      logger: config.logger,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      baseTable: config.baseTable!,
      import: config.import,
    });
  }

  await appCodeUpdater?.afterAll({
    options,
    basePath: config.basePath,
    cache,
    logger: config.logger,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    baseTable: config.baseTable!,
    import: config.import,
  });
}

// Cache `change` functions of migrations. Key is a migration file name, value is array of `change` functions.
// When migrating two or more databases, files are loaded just once due to this cache.
export const changeCache: Record<
  string,
  ChangeCallback<RakeDbColumnTypes>[] | undefined
> = {};

/**
 * Process one migration file.
 * It performs a db transaction, loads `change` functions from a file, executes them in order specified by `up` parameter.
 * After calling `change` functions successfully, will save new entry or delete one in case of `up: false` from the migrations table.
 * After transaction is committed, will call `appCodeUpdater` if exists with the migrated changes.
 */
const runMigration = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  trx: TransactionAdapter,
  up: boolean,
  file: MigrationItem,
  config: RakeDbConfig<SchemaConfig, CT>,
  asts: RakeDbAst[],
) => {
  clearChanges();

  let changes = changeCache[file.path];
  if (!changes) {
    const module = (await file.load()) as
      | {
          default?: MaybeArray<ChangeCallback<RakeDbColumnTypes>>;
        }
      | undefined;

    const exported = module?.default && toArray(module.default);

    if (config.forceDefaultExports && !exported) {
      throw new RakeDbError(
        `Missing a default export in ${file.path} migration`,
      );
    }

    changes = exported || getCurrentChanges();
    changeCache[file.path] = changes;
  }

  const db = createMigrationInterface<SchemaConfig, CT>(trx, up, config, asts);

  if (changes.length) {
    // when up: for (let i = 0; i !== changes.length - 1; i++)
    // when down: for (let i = changes.length - 1; i !== -1; i--)
    const from = up ? 0 : changes.length - 1;
    const to = up ? changes.length : -1;
    const step = up ? 1 : -1;
    for (let i = from; i !== to; i += step) {
      await (changes[i] as unknown as ChangeCallback<CT>)(db, up);
    }
  }

  await (up ? saveMigratedVersion : deleteMigratedVersion)(
    db.adapter,
    file.version,
    path.basename(file.path).slice(file.version.length + 1),
    config,
  );
};
