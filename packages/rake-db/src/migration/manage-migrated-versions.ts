import { RakeDbCtx } from '../common';
import { SilentQueries } from './migration';
import {
  AdapterBase,
  QueryLogger,
  QuerySchema,
  RecordOptionalString,
  RecordString,
  RecordUnknown,
} from 'pqb';
import { RakeDbConfig, RakeDbRenameMigrations } from '../config';
import path from 'path';
import {
  getDigitsPrefix,
  getMigrations,
  getMigrationVersion,
} from './migrations-set';
import {
  renameMigrationVersionsInDb,
  RenameMigrationVersionsValue,
} from '../commands/change-ids';
import {
  getMigrationsSchemaAndTable,
  migrationsSchemaTableSql,
} from './migration.utils';
import { createSchema, createTable } from '../commands/create-or-drop';

export const saveMigratedVersion = async (
  db: SilentQueries,
  version: string,
  name: string,
  config: Pick<RakeDbConfig, 'migrationsTable'>,
): Promise<void> => {
  await db.silentArrays(
    `INSERT INTO ${migrationsSchemaTableSql(
      config,
    )}(version, name) VALUES ($1, $2)`,
    [version, name],
  );
};

export const createMigrationsSchemaAndTable = async (
  adapter: AdapterBase,
  config: {
    schema?: QuerySchema;
    migrationsTable: string;
    logger?: QueryLogger;
  },
): Promise<void> => {
  const { schema, table } = getMigrationsSchemaAndTable(config);
  if (schema) {
    const res = await createSchema(adapter, schema);
    if (res === 'done') {
      config.logger?.log(`Created schema "${schema}"`);
    }
  }

  const res = await createTable(
    adapter,
    `${
      schema ? `"${schema}"."${table}"` : `"${table}"`
    } (version TEXT NOT NULL, name TEXT NOT NULL)`,
  );
  if (res === 'done') {
    config.logger?.log(
      `Created migration versions table ${
        schema ? `"${schema}".` : ''
      }"${table}"`,
    );
  }
};

export const deleteMigratedVersion = async (
  adapter: SilentQueries,
  version: string,
  name: string,
  config: Pick<RakeDbConfig, 'migrationsTable'>,
) => {
  const res = await adapter.silentArrays(
    `DELETE FROM ${migrationsSchemaTableSql(
      config,
    )} WHERE version = $1 AND name = $2`,
    [version, name],
  );

  if (res.rowCount === 0) {
    throw new Error(`Migration ${version}_${name} was not found in db`);
  }
};

export type RakeDbAppliedVersions = {
  map: RecordOptionalString;
  sequence: number[];
};

export class NoMigrationsTableError extends Error {}

export const getMigratedVersionsMap = async (
  ctx: RakeDbCtx,
  adapter: AdapterBase,
  config: RakeDbConfig,
  renameTo?: RakeDbRenameMigrations,
): Promise<RakeDbAppliedVersions> => {
  try {
    const table = migrationsSchemaTableSql(config);

    const result = await adapter.arrays<[string, string]>(
      `SELECT * FROM ${table} ORDER BY version`,
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
          adapter.arrays(`UPDATE ${table} SET name = $2 WHERE version = $1`, [
            version,
            name,
          ]),
        ),
      );

      await adapter.arrays(
        `ALTER TABLE ${table} ALTER COLUMN name SET NOT NULL`,
      );
    }

    let versions = Object.fromEntries(result.rows);

    if (renameTo) {
      versions = await renameMigrations(config, adapter, versions, renameTo);
    }

    return { map: versions, sequence: result.rows.map((row) => +row[0]) };
  } catch (err) {
    if ((err as RecordUnknown).code === '42P01') {
      throw new NoMigrationsTableError();
    } else {
      throw err;
    }
  }
};

async function renameMigrations(
  config: Pick<RakeDbConfig, 'migrationId' | 'migrationsTable'>,
  trx: AdapterBase,
  versions: RecordString,
  renameTo: RakeDbRenameMigrations,
) {
  let first: string | undefined;
  for (const version in versions) {
    first = version;
    break;
  }

  if (!first || getMigrationVersion(config, first)) return versions;

  const values: RenameMigrationVersionsValue[] = [];

  const updatedVersions: RecordString = {};

  const data = await renameTo.map();

  for (const version in versions) {
    const name = versions[version];
    const key = `${version}_${name}`;
    let newVersion = data[key] as string | number;
    if (!newVersion) {
      throw new Error(
        `Failed to find an entry for the migrated ${key} in the renaming config`,
      );
    }

    if (typeof renameTo.to === 'object') {
      newVersion = String(newVersion).padStart(renameTo.to.serial, '0');
    }

    updatedVersions[newVersion] = name;
    values.push([version, name, newVersion]);
  }

  await renameMigrationVersionsInDb(config, trx, values);

  return updatedVersions;
}
