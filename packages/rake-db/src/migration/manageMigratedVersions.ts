import { Adapter, TransactionAdapter } from 'pqb';
import { RakeDbCtx } from '../common';
import { SilentQueries } from './migration';
import {
  ColumnSchemaConfig,
  RecordOptionalString,
  RecordString,
  RecordUnknown,
} from 'orchid-core';
import {
  AnyRakeDbConfig,
  RakeDbConfig,
  RakeDbRenameMigrations,
} from '../config';
import path from 'path';
import {
  getDigitsPrefix,
  getMigrations,
  getMigrationVersion,
} from './migrationsSet';
import {
  renameMigrationVersionsInDb,
  RenameMigrationVersionsValue,
} from '../commands/changeIds';

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
  renameTo?: RakeDbRenameMigrations,
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
