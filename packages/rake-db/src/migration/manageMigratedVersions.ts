import { Adapter, TransactionAdapter } from 'pqb';
import { RakeDbCtx } from '../common';
import { SilentQueries } from './migration';
import {
  ColumnSchemaConfig,
  RecordOptionalString,
  RecordString,
  RecordUnknown,
} from 'orchid-core';
import { AnyRakeDbConfig, RakeDbConfig, RakeDbMigrationId } from '../config';
import path from 'path';
import {
  getDigitsPrefix,
  getMigrations,
  getMigrationVersion,
} from './migrationsSet';
import {
  fileNamesToChangeMigrationId,
  renameMigrationVersionsInDb,
  RenameMigrationVersionsValue,
} from '../commands/changeIds';
import fs from 'fs/promises';
import { pathToFileURL } from 'node:url';

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
    text: `INSERT INTO "${config.migrationsTable}"(version, name) VALUES ($1, $2)`,
    values: [version, name],
  });
};

export const deleteMigratedVersion = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  db: SilentQueries,
  version: string,
  name: string,
  config: RakeDbConfig<SchemaConfig, CT>,
) => {
  const res = await db.silentArrays({
    text: `DELETE FROM "${config.migrationsTable}" WHERE version = $1 AND name = $2`,
    values: [version, name],
  });

  if (res.rowCount === 0) {
    throw new Error(`Migration ${version}_${name} was not found in db`);
  }
};

export class NoMigrationsTableError extends Error {}

export type RakeDbAppliedVersions = {
  map: RecordOptionalString;
  sequence: number[];
};

export const getMigratedVersionsMap = async <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  ctx: RakeDbCtx,
  adapter: Adapter | TransactionAdapter,
  config: RakeDbConfig<SchemaConfig, CT>,
  renameTo?: RakeDbMigrationId,
): Promise<RakeDbAppliedVersions> => {
  try {
    const table = `"${config.migrationsTable}"`;

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
  config: AnyRakeDbConfig,
  trx: Adapter | TransactionAdapter,
  versions: RecordString,
  renameTo: RakeDbMigrationId,
) {
  let first: string | undefined;
  for (const version in versions) {
    first = version;
    break;
  }

  if (!first || getMigrationVersion(config, first)) return versions;

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

  for (const version in versions) {
    const name = versions[version];
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
