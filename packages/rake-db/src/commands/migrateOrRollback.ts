import { Adapter, AdapterOptions, MaybeArray, toArray } from 'pqb';
import {
  createSchemaMigrations,
  getMigrationFiles,
  MigrationConfig,
  MigrationFile,
  quoteTable,
} from '../common';
import {
  getCurrentPromise,
  setCurrentMigrationUp,
  setCurrentMigration, ChangeCallback, change, getCurrentChangeCallback,
} from '../migration/change';
import { Migration } from '../migration/migration';

const migrateOrRollback = async (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
  args: string[],
  up: boolean,
) => {
  const files = await getMigrationFiles(config, up);

  const argCount = args[0] === 'all' ? Infinity : parseInt(args[0]);
  let count = isNaN(argCount) ? (up ? Infinity : 1) : argCount;

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

        await processMigration(db, up, file, config);
        config.logger?.log(`${file.path} ${up ? 'migrated' : 'rolled back'}`);
      }
    } finally {
      await db.destroy();
    }
  }
};

const changeCache: Record<string, ChangeCallback | undefined> = {}

const processMigration = async (
  db: Adapter,
  up: boolean,
  file: MigrationFile,
  config: MigrationConfig,
) => {
  await db.transaction(async (tx) => {
    const db = new Migration(tx, up, config);
    setCurrentMigration(db);
    setCurrentMigrationUp(up);

    const callback = changeCache[file.path]
    if (callback) {
      change(callback)
    } else {
      config.requireTs(file.path);
      changeCache[file.path] = getCurrentChangeCallback()
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
  config: MigrationConfig,
) => {
  await db.query(
    `INSERT INTO ${quoteTable(config.migrationsTable)} VALUES ('${version}')`,
  );
};

const removeMigratedVersion = async (
  db: Adapter,
  version: string,
  config: MigrationConfig,
) => {
  await db.query(
    `DELETE FROM ${quoteTable(
      config.migrationsTable,
    )} WHERE version = '${version}'`,
  );
};

const getMigratedVersionsMap = async (
  db: Adapter,
  config: MigrationConfig,
): Promise<Record<string, boolean>> => {
  try {
    const result = await db.arrays<[string]>(
      `SELECT * FROM ${quoteTable(config.migrationsTable)}`,
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
  config: MigrationConfig,
  args: string[] = [],
) => migrateOrRollback(options, config, args, true);

export const rollback = (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
  args: string[] = [],
) => migrateOrRollback(options, config, args, false);
