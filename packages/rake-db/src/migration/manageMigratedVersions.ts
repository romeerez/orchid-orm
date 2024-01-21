import { TransactionAdapter } from 'pqb';
import {
  createSchemaMigrations,
  quoteWithSchema,
  RakeDbConfig,
} from '../common';
import { SilentQueries } from './migration';

export const saveMigratedVersion = async <CT>(
  db: SilentQueries,
  version: string,
  config: RakeDbConfig<CT>,
): Promise<void> => {
  await db.silentArrays(
    `INSERT INTO ${quoteWithSchema({
      name: config.migrationsTable,
    })} VALUES ('${version}')`,
  );
};

export const removeMigratedVersion = async <CT>(
  db: SilentQueries,
  version: string,
  config: RakeDbConfig<CT>,
) => {
  await db.silentArrays(
    `DELETE FROM ${quoteWithSchema({
      name: config.migrationsTable,
    })} WHERE version = '${version}'`,
  );
};

export const getMigratedVersionsMap = async <CT>(
  db: TransactionAdapter,
  config: RakeDbConfig<CT>,
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
