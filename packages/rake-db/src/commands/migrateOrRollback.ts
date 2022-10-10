import { Adapter, AdapterOptions, MaybeArray, toArray } from 'pqb';
import {
  createSchemaMigrations,
  getMigrationFiles,
  MigrationConfig,
  MigrationFile,
} from './common';
import {
  getCurrentPromise,
  setCurrentMigrationUp,
  setDbForMigration,
} from '../migration/change';

const migrateOrRollback = async (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
  up: boolean,
) => {
  const files = await getMigrationFiles(config, up);

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

        await processMigration(db, up, file, config);
      }
    } finally {
      await db.destroy();
    }
  }
};

const processMigration = async (
  db: Adapter,
  up: boolean,
  file: MigrationFile,
  config: MigrationConfig,
) => {
  await db.transaction(async (db) => {
    setDbForMigration(db);
    setCurrentMigrationUp(up);
    config.requireTs(file.path);
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
    `INSERT INTO "${config.migrationsTable}" VALUES ('${version}')`,
  );
};

const removeMigratedVersion = async (
  db: Adapter,
  version: string,
  config: MigrationConfig,
) => {
  await db.query(
    `DELETE FROM "${config.migrationsTable}" WHERE version = '${version}'`,
  );
};

const getMigratedVersionsMap = async (
  db: Adapter,
  config: MigrationConfig,
): Promise<Record<string, boolean>> => {
  try {
    const result = await db.arrays<[string]>(
      `SELECT * FROM "${config.migrationsTable}"`,
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
) => migrateOrRollback(options, config, true);

export const rollback = (
  options: MaybeArray<AdapterOptions>,
  config: MigrationConfig,
) => migrateOrRollback(options, config, false);
