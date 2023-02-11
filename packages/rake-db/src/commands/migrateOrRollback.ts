import {
  Adapter,
  AdapterOptions,
  createDb,
  DbResult,
  DefaultColumnTypes,
  MaybeArray,
  toArray,
} from 'pqb';
import {
  createSchemaMigrations,
  getMigrationFiles,
  RakeDbConfig,
  MigrationFile,
  quoteWithSchema,
} from '../common';
import {
  clearChanges,
  ChangeCallback,
  getCurrentChanges,
} from '../migration/change';
import { createMigrationInterface } from '../migration/migration';
import { pathToFileURL } from 'url';

const getDb = (adapter: Adapter) => createDb({ adapter });

export const migrateOrRollback = async (
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig,
  args: string[],
  up: boolean,
) => {
  config = { ...config };
  const files = await getMigrationFiles(config, up);

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
        config.logger?.log(`${file.path} ${up ? 'migrated' : 'rolled back'}`);
      }

      if (up) {
        await config.afterMigrate?.((db ??= getDb(adapter)));
      } else {
        await config.afterRollback?.((db ??= getDb(adapter)));
      }
    } finally {
      await adapter.close();
    }
    // use appCodeUpdater only for the first provided options
    delete config.appCodeUpdater;
  }
};

export const changeCache: Record<string, ChangeCallback[] | undefined> = {};

const processMigration = async (
  db: Adapter,
  up: boolean,
  file: MigrationFile,
  config: RakeDbConfig,
  options: AdapterOptions,
  appCodeUpdaterCache: object,
) => {
  await db.transaction(async (tx) => {
    const db = createMigrationInterface(
      tx,
      up,
      config,
      options,
      appCodeUpdaterCache,
    );
    clearChanges();

    let changes = changeCache[file.path];
    if (!changes) {
      await config.import(pathToFileURL(file.path).pathname);
      changes = getCurrentChanges();
      changeCache[file.path] = changes;
    }

    for (const fn of up ? changes : changes.reverse()) {
      await fn(db, up);
    }

    await (up ? saveMigratedVersion : removeMigratedVersion)(
      db.adapter,
      file.version,
      config,
    );
  });
};

const saveMigratedVersion = async (
  db: Adapter,
  version: string,
  config: RakeDbConfig,
) => {
  await db.query(
    `INSERT INTO ${quoteWithSchema({
      name: config.migrationsTable,
    })} VALUES ('${version}')`,
  );
};

const removeMigratedVersion = async (
  db: Adapter,
  version: string,
  config: RakeDbConfig,
) => {
  await db.query(
    `DELETE FROM ${quoteWithSchema({
      name: config.migrationsTable,
    })} WHERE version = '${version}'`,
  );
};

const getMigratedVersionsMap = async (
  db: Adapter,
  config: RakeDbConfig,
): Promise<Record<string, boolean>> => {
  try {
    const result = await db.arrays<[string]>(
      `SELECT * FROM ${quoteWithSchema({ name: config.migrationsTable })}`,
    );
    return Object.fromEntries(result.rows.map((row) => [row[0], true]));
  } catch (err) {
    if ((err as Record<string, unknown>).code === '42P01') {
      await createSchemaMigrations(db, config);
      return {};
    }
    throw err;
  }
};

export const migrate = (
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig,
  args: string[] = [],
) => migrateOrRollback(options, config, args, true);

export const rollback = (
  options: MaybeArray<AdapterOptions>,
  config: RakeDbConfig,
  args: string[] = [],
) => migrateOrRollback(options, config, args, false);
