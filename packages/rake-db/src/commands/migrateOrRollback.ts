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
  RecordString,
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
  removeMigratedVersion,
  saveMigratedVersion,
} from '../migration/manageMigratedVersions';
import { RakeDbError } from '../errors';
import { RakeDbAst } from '../ast';
import {
  AnyRakeDbConfig,
  AppCodeUpdater,
  RakeDbConfig,
  RakeDbMigrationId,
} from '../config';
import path from 'path';
import {
  fileNamesToChangeMigrationId,
  renameMigrationVersionsInDb,
  RenameMigrationVersionsValue,
} from './changeIds';
import fs from 'fs/promises';
import { pathToFileURL } from 'node:url';
import { createMigrationsTable } from '../migration/migrationsTable';
import {
  getMigrations,
  getMigrationVersion,
  MigrationItem,
  MigrationsSet,
} from '../migration/migrationsSet';

export const RAKE_DB_LOCK_KEY = '8582141715823621641';

type MigrateFn = <
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  ctx: RakeDbCtx,
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig<SchemaConfig, CT>,
  args?: string[],
) => Promise<void>;

function makeMigrateFn<
  SchemaConfig extends ColumnSchemaConfig,
  CT extends RakeDbColumnTypes,
>(
  defaultCount: number,
  up: boolean,
  fn: (
    ctx: RakeDbCtx,
    trx: TransactionAdapter,
    config: RakeDbConfig<SchemaConfig, CT>,
    migrations: MigrationsSet,
    count: number,
    asts: RakeDbAst[],
  ) => Promise<void>,
): MigrateFn {
  return async (ctx: RakeDbCtx, options, config, args = []) => {
    const set = await getMigrations(ctx, config, up);
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
        await transaction(adapter, async (trx) => {
          await fn(
            ctx,
            trx,
            conf as unknown as RakeDbConfig<SchemaConfig, CT>,
            set,
            count ?? defaultCount,
            localAsts,
          );
        });
      } catch (err) {
        if (err instanceof NoMigrationsTableError) {
          await transaction(adapter, async (trx) => {
            const config = conf as unknown as RakeDbConfig<SchemaConfig, CT>;

            await createMigrationsTable(trx, config);

            await fn(ctx, trx, config, set, count ?? defaultCount, localAsts);
          });
        } else {
          throw err;
        }
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
  (ctx, trx, config, migrations, count, asts) =>
    migrateOrRollback(ctx, trx, config, migrations, count, asts, true),
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
  (ctx, trx, config, migrations, count, asts) =>
    migrateOrRollback(ctx, trx, config, migrations, count, asts, false),
);

/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Takes the same options as {@link migrate}.
 */
export const redo: MigrateFn = makeMigrateFn(
  1,
  true,
  async (ctx, trx, config, set, count, asts) => {
    set.migrations.reverse();

    await migrateOrRollback(ctx, trx, config, set, count, asts, false);

    set.migrations.reverse();

    await migrateOrRollback(ctx, trx, config, set, count, asts, true, true);
  },
);

const getDb = (adapter: Adapter) =>
  createDb<ColumnSchemaConfig, RakeDbColumnTypes>({ adapter });

const getCount = (args: string[]): number | undefined => {
  const num = args[0] === 'all' ? Infinity : parseInt(args[0]);
  return isNaN(num) ? undefined : num;
};

function prepareConfig<SchemaConfig extends ColumnSchemaConfig, CT>(
  config: RakeDbConfig<SchemaConfig, CT>,
  args: string[],
  count?: number,
): RakeDbConfig<SchemaConfig, CT> {
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
  ctx: RakeDbCtx,
  trx: TransactionAdapter,
  config: RakeDbConfig<ColumnSchemaConfig, RakeDbColumnTypes>,
  set: MigrationsSet,
  count: number,
  asts: RakeDbAst[],
  up: boolean,
  skipLock?: boolean,
): Promise<void> => {
  if (!skipLock) await queryLock(trx);

  let db: DbResult<RakeDbColumnTypes> | undefined;

  await config[up ? 'beforeMigrate' : 'beforeRollback']?.((db ??= getDb(trx)));

  let migratedVersions = await getMigratedVersionsMap(ctx, trx, config);

  if (set.renameTo) {
    migratedVersions = await renameMigrations(
      config,
      trx,
      migratedVersions,
      set.renameTo,
    );
  }

  for (const file of set.migrations) {
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

async function renameMigrations(
  config: AnyRakeDbConfig,
  trx: TransactionAdapter,
  migratedVersions: RecordString,
  renameTo: RakeDbMigrationId,
) {
  let first: string | undefined;
  for (const version in migratedVersions) {
    first = version;
    break;
  }

  if (!first || getMigrationVersion(config, first)) return migratedVersions;

  const fileName = fileNamesToChangeMigrationId[renameTo];
  const filePath = path.join(config.migrationsPath, fileName);

  const json = await fs.readFile(filePath, 'utf-8');

  let data: RecordString;
  try {
    data = JSON.parse(json);
    if (typeof data !== 'object')
      throw new Error('Config for renaming is not an object');
  } catch (err) {
    throw new Error(`Failed to read ${pathToFileURL(filePath)}`, {
      cause: err,
    });
  }

  const values: RenameMigrationVersionsValue[] = [];

  const updatedVersions: RecordString = {};

  for (const version in migratedVersions) {
    const name = migratedVersions[version];
    const key = `${version}_${name}`;
    let newVersion = data[key];
    if (!newVersion) {
      throw new Error(
        `Failed to find an entry for the migrated ${key} in the ${fileName} config`,
      );
    }

    if (renameTo === 'serial') {
      newVersion = String(newVersion).padStart(4, '0');
    }

    updatedVersions[newVersion] = name;
    values.push([version, name, newVersion]);
  }

  await renameMigrationVersionsInDb(config, trx, values);

  return updatedVersions;
}

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

  await (up ? saveMigratedVersion : removeMigratedVersion)(
    db.adapter,
    file.version,
    path.basename(file.path).slice(file.version.length + 1),
    config,
  );
};
