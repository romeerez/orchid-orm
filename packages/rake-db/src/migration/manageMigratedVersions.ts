import { Adapter, TransactionAdapter } from 'pqb';
import { quoteWithSchema, RakeDbCtx } from '../common';
import { SilentQueries } from './migration';
import { ColumnSchemaConfig, RecordString, RecordUnknown } from 'orchid-core';
import { RakeDbConfig } from '../config';
import path from 'path';
import { getDigitsPrefix, getMigrations } from './migrationsSet';

export const saveMigratedVersion = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  db: SilentQueries,
  version: string,
  name: string,
  config: RakeDbConfig<SchemaConfig, CT>,
): Promise<void> => {
  await db.silentArrays({
    text: `INSERT INTO ${quoteWithSchema({
      name: config.migrationsTable,
    })}(version, name) VALUES ($1, $2)`,
    values: [version, name],
  });
};

export const removeMigratedVersion = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  db: SilentQueries,
  version: string,
  name: string,
  config: RakeDbConfig<SchemaConfig, CT>,
) => {
  const res = await db.silentArrays({
    text: `DELETE FROM ${quoteWithSchema({
      name: config.migrationsTable,
    })} WHERE version = $1 AND name = $2`,
    values: [version, name],
  });

  if (res.rowCount === 0) {
    throw new Error(`Migration ${version}_${name} was not found in db`);
  }
};

export class NoMigrationsTableError extends Error {}

export const getMigratedVersionsMap = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  ctx: RakeDbCtx,
  adapter: Adapter | TransactionAdapter,
  config: RakeDbConfig<SchemaConfig, CT>,
): Promise<RecordString> => {
  try {
    const table = quoteWithSchema({
      name: config.migrationsTable,
    });

    const result = await adapter.arrays<[string, string]>(
      `SELECT * FROM ${table}`,
    );

    if (!result.fields[1]) {
      const { migrations } = await getMigrations(ctx, config, true);

      const map: RecordString = {};
      for (const item of migrations) {
        const name = path.basename(item.path);
        map[item.version] = name.slice(getDigitsPrefix(name).length + 1);
      }

      for (const row of result.rows) {
        const [version] = row;
        const name = map[version];
        if (!name) {
          throw new Error(
            `Migration for version ${version} is stored in db but is not found among available migrations`,
          );
        }

        row[1] = name;
      }

      await adapter.arrays(`ALTER TABLE ${table} ADD COLUMN name TEXT`);

      await Promise.all(
        result.rows.map(([version, name]) =>
          adapter.arrays({
            text: `UPDATE ${table} SET name = $2 WHERE version = $1`,
            values: [version, name],
          }),
        ),
      );

      await adapter.arrays(
        `ALTER TABLE ${table} ALTER COLUMN name SET NOT NULL`,
      );
    }

    return Object.fromEntries(result.rows);
  } catch (err) {
    if ((err as RecordUnknown).code === '42P01') {
      throw new NoMigrationsTableError();
    } else {
      throw err;
    }
  }
};
