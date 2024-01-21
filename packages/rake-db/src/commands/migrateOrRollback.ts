import {
  Adapter,
  AdapterOptions,
  createDb,
  DbResult,
  TransactionAdapter,
} from 'pqb';
import {
  ColumnSchemaConfig,
  emptyArray,
  MaybeArray,
  pathToLog,
  toArray,
} from 'orchid-core';
import {
  AppCodeUpdater,
  getMigrations,
  MigrationItem,
  RakeDbColumnTypes,
  RakeDbConfig,
} from '../common';
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
import { RakeDbAst } from '../ast';

export const RAKE_DB_LOCK_KEY = '8582141715823621641';

type MigrateFn = <CT extends RakeDbColumnTypes>(
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<CT>,
  args?: string[],
) => Promise<void>;

function makeMigrateFn<CT extends RakeDbColumnTypes>(
  defaultCount: number,
  up: boolean,
  fn: (
    trx: TransactionAdapter,
    config: RakeDbConfig<CT>,
    files: MigrationItem[],
    count: number,
    asts: RakeDbAst[],
  ) => Promise<void>,
): MigrateFn {
  return async (options, config, args = []) => {
    const files = await getMigrations(config, up);
    const count = getCount(args);
    const conf = prepareConfig(config, args, count);
    const asts: RakeDbAst[] = [];
    const appCodeUpdaterCache = {};
    const { appCodeUpdater } = conf;
    const arrOptions = toArray(options);
    let localAsts = asts;
    for (const opts of arrOptions) {
      const adapter = new Adapter(opts);

      try {
        await adapter.transaction(begin, async (trx) => {
          await trx.query(
            `SELECT pg_advisory_xact_lock('${RAKE_DB_LOCK_KEY}')`,
          );

          await fn(
            trx,
            conf as unknown as RakeDbConfig<CT>,
            files,
            count ?? defaultCount,
            localAsts,
          );
        });
      } finally {
        await adapter.close();
      }

      // ignore asts after the first db was migrated
      localAsts = [];
    }

    await runCodeUpdaterAfterAll(
      arrOptions[0],
      config,
      appCodeUpdater,
      asts,
      appCodeUpdaterCache,
    );
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
  (trx, config, files, count, asts) =>
    migrateOrRollback(trx, config, files, count, asts, true),
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
  (trx, config, files, count, asts) =>
    migrateOrRollback(trx, config, files, count, asts, false),
);

/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Takes the same options as {@link migrate}.
 */
export const redo: MigrateFn = makeMigrateFn(
  1,
  false,
  async (trx, config, files, count, asts) => {
    await migrateOrRollback(trx, config, files, count, asts, false);

    files.reverse();

    await migrateOrRollback(trx, config, files, count, asts, true);

    files.reverse();
  },
);

const getDb = (adapter: Adapter) =>
  createDb<ColumnSchemaConfig, RakeDbColumnTypes>({ adapter });

const getCount = (args: string[]): number | undefined => {
  const num = args[0] === 'all' ? Infinity : parseInt(args[0]);
  return isNaN(num) ? undefined : num;
};

function prepareConfig<CT>(
  config: RakeDbConfig<CT>,
  args: string[],
  count?: number,
): RakeDbConfig<CT> {
  config = { ...config };

  const i = count === undefined ? 0 : 1;
  const arg = args[i];
  if (arg === '--code') {
    config.useCodeUpdater = args[i + 1] !== 'false';
  }

  if (!config.useCodeUpdater) delete config.appCodeUpdater;
  return config;
}

export const migrateOrRollback = async (
  trx: TransactionAdapter,
  config: RakeDbConfig<RakeDbColumnTypes>,
  files: MigrationItem[],
  count: number,
  asts: RakeDbAst[],
  up: boolean,
): Promise<void> => {
  let db: DbResult<RakeDbColumnTypes> | undefined;

  await config[up ? 'beforeMigrate' : 'beforeRollback']?.((db ??= getDb(trx)));

  const migratedVersions = await getMigratedVersionsMap(trx, config);
  for (const file of files) {
    if (
      (up && migratedVersions[file.version]) ||
      (!up && !migratedVersions[file.version])
    ) {
      continue;
    }

    if (count-- <= 0) break;

    await runMigration(trx, up, file, config, asts);

    config.logger?.log(
      `${up ? 'Migrated' : 'Rolled back'} ${pathToLog(file.path)}`,
    );
  }

  await config[up ? 'afterMigrate' : 'afterRollback']?.((db ??= getDb(trx)));
};

async function runCodeUpdaterAfterAll<CT>(
  options: AdapterOptions,
  config: RakeDbConfig<CT>,
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
  ChangeCallback<ColumnSchemaConfig, RakeDbColumnTypes>[] | undefined
> = {};

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
const runMigration = async <CT extends RakeDbColumnTypes>(
  trx: TransactionAdapter,
  up: boolean,
  file: MigrationItem,
  config: RakeDbConfig<CT>,
  asts: RakeDbAst[],
) => {
  clearChanges();

  let changes = changeCache[file.path];
  if (!changes) {
    const module = (await file.load()) as
      | {
          default?: MaybeArray<
            ChangeCallback<ColumnSchemaConfig, RakeDbColumnTypes>
          >;
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

  const db = createMigrationInterface<ColumnSchemaConfig, CT>(
    trx,
    up,
    config,
    asts,
  );

  if (changes.length) {
    // when up: for (let i = 0; i !== changes.length - 1; i++)
    // when down: for (let i = changes.length - 1; i !== -1; i--)
    const from = up ? 0 : changes.length - 1;
    const to = up ? changes.length : -1;
    const step = up ? 1 : -1;
    for (let i = from; i !== to; i += step) {
      await (changes[i] as unknown as ChangeCallback<ColumnSchemaConfig, CT>)(
        db,
        up,
      );
    }
  }

  await (up ? saveMigratedVersion : removeMigratedVersion)(
    db.adapter,
    file.version,
    config,
  );
};
