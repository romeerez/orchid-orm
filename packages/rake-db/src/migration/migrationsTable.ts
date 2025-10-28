import { RakeDbConfig } from '../config';
import { AdapterBase, ColumnSchemaConfig, RecordUnknown } from 'pqb';

export const createMigrationsTable = async (
  db: AdapterBase,
  config: Pick<RakeDbConfig<ColumnSchemaConfig>, 'migrationsTable' | 'logger'>,
) => {
  const { schema } = db;
  if (schema && schema !== 'public') {
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      config.logger?.log(`Created schema ${schema}`);
    } catch (err) {
      if ((err as { code: string }).code !== '42P06') {
        throw err;
      }
    }
  }

  try {
    await db.query(
      `CREATE TABLE "${config.migrationsTable}" ( version TEXT NOT NULL, name TEXT NOT NULL )`,
    );
    config.logger?.log('Created versions table');
  } catch (err) {
    if ((err as RecordUnknown).code === '42P07') {
      config.logger?.log('Versions table exists');
    } else {
      throw err;
    }
  }
};
