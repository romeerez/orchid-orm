import {
  Adapter,
  AdapterOptions,
  createDb,
  DbResult,
  DefaultColumnTypes,
} from 'pqb';
import {
  ColumnTypesBase,
  emptyArray,
  MaybeArray,
  pathToLog,
  toArray,
} from 'orchid-core';
import { getMigrations, MigrationItem, RakeDbConfig } from '../common';
import {
  ChangeCallback,
  clearChanges,
  getCurrentChanges,
} from '../migration/change';
import { createMigrationInterface } from '../migration/migration';
import {
  getMigratedVersionsMap,
  removeMigratedVersion,
  saveMigratedVersion,
} from '../migration/manageMigratedVersions';
import { RakeDbError } from '../errors';

const getDb = (adapter: Adapter) => createDb({ adapter });

export const migrateOrRollback = async <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[],
  up: boolean,
): Promise<void> => {
  config = { ...config };
  const files = await getMigrations(config, up);

  let count = up ? Infinity : 1;
  let argI = 0;
  const num = args[0] === 'all' ? Infinity : parseInt(args[0]);
  if (!isNaN(num)) {
    argI++;
    count = num;
  }

  const arg = args[argI];
  if (arg === '--code') {
    config.useCodeUpdater = args[argI + 1] !== 'false';
  }

  if (!config.useCodeUpdater) delete config.appCodeUpdater;

  const appCodeUpdaterCache = {};

  for (const opts of toArray(options)) {
    const adapter = new Adapter(opts);
    let db: DbResult<DefaultColumnTypes> | undefined;

    if (up) {
      await config.beforeMigrate?.((db ??= getDb(adapter)));
    } else {
      await config.beforeRollback?.((db ??= getDb(adapter)));
    }

    const migratedVersions = await getMigratedVersionsMap(adapter, config);
    try {
      for (const file of files) {
        if (
          (up && migratedVersions[file.version]) ||
          (!up && !migratedVersions[file.version])
        ) {
          continue;
        }

        if (count-- <= 0) break;

        await processMigration(
          adapter,
          up,
          file,
          config,
          opts,
          appCodeUpdaterCache,
        );

        config.logger?.log(
          `${up ? 'Migrated' : 'Rolled back'} ${pathToLog(file.path)}`,
        );
      }

      if (up) {
        await config.afterMigrate?.((db ??= getDb(adapter)));
      } else {
        await config.afterRollback?.((db ??= getDb(adapter)));
      }
    } finally {
      await config.appCodeUpdater?.afterAll({
        options: opts,
        basePath: config.basePath,
        cache: appCodeUpdaterCache,
        logger: config.logger,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        baseTable: config.baseTable!,
        import: config.import,
      });

      await adapter.close();
    }
    // use appCodeUpdater only for the first provided options
    delete config.appCodeUpdater;
  }
};

// Cache `change` functions of migrations. Key is a migration file name, value is array of `change` functions.
// When migrating two or more databases, files are loaded just once due to this cache.
export const changeCache: Record<string, ChangeCallback[] | undefined> = {};

// SQL to start a transaction
const begin = {
  text: 'BEGIN',
  values: emptyArray,
};

/**
 * Process one migration file.
 * It performs a db transaction, loads `change` functions from a file, executes them in order specified by `up` parameter.
 * After calling `change` functions successfully, will save new entry or delete one in case of `up: false` from the migrations table.
 * After transaction is committed, will call `appCodeUpdater` if exists with the migrated changes.
 */
const processMigration = async <CT extends ColumnTypesBase>(
  db: Adapter,
  up: boolean,
  file: MigrationItem,
  config: RakeDbConfig<CT>,
  options: AdapterOptions,
  appCodeUpdaterCache: object,
) => {
  const asts = await db.transaction(begin, async (tx) => {
    clearChanges();

    let changes = changeCache[file.path];
    if (!changes) {
      const module = (await file.load()) as
        | {
            default?: MaybeArray<ChangeCallback>;
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

    const db = createMigrationInterface<CT>(tx, up, config);

    for (const fn of up ? changes : changes.reverse()) {
      await fn(db, up);
    }

    await (up ? saveMigratedVersion : removeMigratedVersion)(
      db.adapter,
      file.version,
      config,
    );

    return db.migratedAsts;
  });

  for (const ast of asts) {
    await config.appCodeUpdater?.process({
      ast,
      options,
      basePath: config.basePath,
      cache: appCodeUpdaterCache,
      logger: config.logger,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      baseTable: config.baseTable!,
      import: config.import,
    });
  }
};

/**
 * Will run all pending yet migrations, sequentially in order,
 * will apply `change` functions top-to-bottom.
 *
 * @param options - options to construct db adapter with
 * @param config - specifies how to load migrations, may have `appCodeUpdater`, callbacks, and logger.
 * @param args - pass none or `all` to run all migrations, pass int for how many to migrate, `--code` to enable and `--code false` to disable `useCodeUpdater`.
 */
export const migrate = <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = [],
): Promise<void> => migrateOrRollback(options, config, args, true);

/**
 * Will roll back one latest applied migration,
 * will apply `change` functions bottom-to-top.
 *
 * Takes the same options as {@link migrate}.
 */
export const rollback = <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = [],
): Promise<void> => migrateOrRollback(options, config, args, false);

/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Takes the same options as {@link migrate}.
 */
export const redo = async <CT extends ColumnTypesBase>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args: string[] = [],
): Promise<void> => {
  await migrateOrRollback(options, config, args, false);

  // because we just called rollback, `change` functions are cached bottom-to-top.
  // now we are about to migrate, and need to reverse cached functions.
  for (const file in changeCache) {
    changeCache[file]?.reverse();
  }

  await migrateOrRollback(options, config, args, true);
};
