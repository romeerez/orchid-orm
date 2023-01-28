import { Adapter, AdapterOptions, MaybeArray, toArray } from 'pqb';
import {
  createSchemaMigrations,
  getMigrationFiles,
  RakeDbConfig,
  MigrationFile,
  quoteWithSchema,
} from '../common';
import {
  getCurrentPromise,
  setCurrentMigrationUp,
  setCurrentMigration,
  ChangeCallback,
  change,
  getCurrentChangeCallback,
} from '../migration/change';
import { Migration } from '../migration/migration';

const migrateOrRollback = async (
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
    const db = new Adapter(opts);
    const migratedVersions = await getMigratedVersionsMap(db, config);
    try {
      for (const file of files) {
        if (
          (up && migratedVersions[file.version]) ||
          (!up && !migratedVersions[file.version])
        ) {
          continue;
        }

        if (count-- <= 0) break;

        await processMigration(db, up, file, config, opts, appCodeUpdaterCache);
        config.logger?.log(`${file.path} ${up ? 'migrated' : 'rolled back'}`);
      }
    } finally {
      await db.close();
    }
    // use appCodeUpdater only for the first provided options
    delete config.appCodeUpdater;
  }
};

const changeCache: Record<string, ChangeCallback | undefined> = {};

const processMigration = async (
  db: Adapter,
  up: boolean,
  file: MigrationFile,
  config: RakeDbConfig,
  options: AdapterOptions,
  appCodeUpdaterCache: object,
) => {
  await db.transaction(async (tx) => {
    const db = new Migration(tx, up, config, options, appCodeUpdaterCache);
    setCurrentMigration(db);
    setCurrentMigrationUp(up);

    const callback = changeCache[file.path];
    if (callback) {
      change(callback);
    } else {
      await config.requireTs(file.path);
      changeCache[file.path] = getCurrentChangeCallback();
    }

    await getCurrentPromise();
    await (up ? saveMigratedVersion : removeMigratedVersion)(
      db,
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
