import { RakeDbCtx } from '../common';
import { SilentQueries } from './migration';
import {
  Adapter,
  getDriverErrorCode,
  QueryLogger,
  RecordOptionalString,
  RecordString,
  TransactionAdapter,
} from 'pqb/internal';
import { RakeDbConfig, RakeDbRenameMigrations } from '../config/config';
import { getMigrationVersion } from './migrations-set';
import {
  renameMigrationVersionsInDb,
  RenameMigrationVersionsValue,
} from '../commands/change-ids';
import {
  getMigrationsSchemaAndTable,
  migrationsSchemaTableSql,
} from './migration.utils';
import { createSchema, createTable } from '../commands/create-or-drop';
import { DbParam, getMaybeTransactionAdapter } from '../utils';
import { MigrateConfigInternal } from '../commands/migrate-or-rollback';

export const saveMigratedVersion = async (
  db: SilentQueries,
  version: string,
  name: string,
  config: Pick<RakeDbConfig, 'migrationsTable'>,
): Promise<void> => {
  await db.silentArrays(
    `INSERT INTO ${migrationsSchemaTableSql(
      db,
      config,
    )}(version, name) VALUES ($1, $2)`,
    [version, name],
  );
};

export const createMigrationsSchemaAndTable = async (
  db: DbParam,
  config: {
    migrationsTable: string;
    logger?: QueryLogger;
  },
): Promise<void> => {
  const adapter = getMaybeTransactionAdapter(db);
  const { schema, table } = getMigrationsSchemaAndTable(adapter, config);
  if (schema) {
    const res = await createSchema(db, schema);
    if (res === 'done') {
      config.logger?.log(`Created schema "${schema}"`);
    }
  }

  const res = await createTable(
    db,
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
      adapter,
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
  _ctx: RakeDbCtx,
  adapter: Adapter | TransactionAdapter,
  config: Pick<
    MigrateConfigInternal,
    | 'migrations'
    | 'basePath'
    | 'migrationId'
    | 'migrationsPath'
    | 'import'
    | 'migrationsTable'
  >,
  renameTo?: RakeDbRenameMigrations,
): Promise<RakeDbAppliedVersions> => {
  const table = migrationsSchemaTableSql(adapter, config);

  const queryVersion = () =>
    adapter.query<{ version: string; name: string }>(
      `SELECT * FROM ${table} ORDER BY version`,
    );

  let result;
  try {
    if (adapter.isInTransaction()) {
      result = await adapter.savepoint('check_migrations_table', queryVersion);
    } else {
      result = await queryVersion();
    }
  } catch (err) {
    if (err && typeof err === 'object' && getDriverErrorCode(err) === '42P01') {
      throw new NoMigrationsTableError();
    } else {
      throw err;
    }
  }

  let versions = Object.fromEntries(
    result.rows.map(({ version, name }) => [version, name]),
  );

  if (renameTo) {
    versions = await renameMigrations(config, adapter, versions, renameTo);
  }

  return { map: versions, sequence: result.rows.map((row) => +row.version) };
};

async function renameMigrations(
  config: Pick<RakeDbConfig, 'migrationId' | 'migrationsTable'>,
  trx: Adapter,
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
