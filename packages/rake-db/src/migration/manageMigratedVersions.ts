import { Adapter } from 'pqb';
import {
  createSchemaMigrations,
  quoteWithSchema,
  RakeDbConfig,
} from '../common';

export const saveMigratedVersion = async (
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

export const removeMigratedVersion = async (
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

export const getMigratedVersionsMap = async (
  db: Adapter,
  config: RakeDbConfig,
): Promise<Record<string, boolean>> => {
  try {
    const result = await db.arrays<[string]>(
      `SELECT *
       FROM ${quoteWithSchema({ name: config.migrationsTable })}`,
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
