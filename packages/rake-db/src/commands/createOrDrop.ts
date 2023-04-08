import { Adapter, AdapterOptions } from 'pqb';
import { MaybeArray, toArray } from 'orchid-core';
import {
  getDatabaseAndUserFromOptions,
  setAdminCredentialsToOptions,
  setAdapterOptions,
  createSchemaMigrations,
  RakeDbConfig,
  migrationConfigDefaults,
} from '../common';
import { migrate } from './migrateOrRollback';

const execute = async (
  options: AdapterOptions,
  sql: string,
): Promise<
  'ok' | 'already' | 'forbidden' | 'ssl required' | { error: unknown }
> => {
  const db = new Adapter(options);

  try {
    await db.query(sql);
    return 'ok';
  } catch (error) {
    const err = error as Record<string, unknown>;

    if (
      typeof err.message === 'string' &&
      err.message.includes('sslmode=require')
    ) {
      return 'ssl required';
    }

    if (err.code === '42P04' || err.code === '3D000') {
      return 'already';
    } else if (
      err.code === '42501' ||
      (typeof err.message === 'string' &&
        err.message.includes('password authentication failed'))
    ) {
      return 'forbidden';
    } else {
      return { error };
    }
  } finally {
    await db.close();
  }
};

const createOrDrop = async (
  options: AdapterOptions,
  adminOptions: AdapterOptions,
  config: Pick<RakeDbConfig, 'migrationsTable' | 'logger'>,
  args: {
    sql(params: { database: string; user: string }): string;
    successMessage(params: { database: string }): string;
    alreadyMessage(params: { database: string }): string;
    create?: boolean;
  },
) => {
  const params = getDatabaseAndUserFromOptions(options);

  const result = await execute(
    setAdapterOptions(adminOptions, { database: 'postgres' }),
    args.sql(params),
  );
  if (result === 'ok') {
    config.logger?.log(args.successMessage(params));
  } else if (result === 'already') {
    config.logger?.log(args.alreadyMessage(params));
  } else if (result === 'ssl required') {
    config.logger?.log(
      'SSL is required: append ?ssl=true to the database url string',
    );
    return;
  } else if (result === 'forbidden') {
    let message = `Permission denied to ${
      args.create ? 'create' : 'drop'
    } database.`;

    const host = adminOptions.databaseURL
      ? new URL(adminOptions.databaseURL).hostname
      : adminOptions.host;

    const isLocal = host === 'localhost';
    if (!isLocal) {
      message += `\nDon't use this command for database service providers, only for a local db.`;
    }

    config.logger?.log(message);

    const updatedOptions = await setAdminCredentialsToOptions(
      options,
      args.create,
    );
    if (!updatedOptions) return;

    await createOrDrop(options, updatedOptions, config, args);
    return;
  } else {
    throw result.error;
  }

  if (!args.create) return;

  const db = new Adapter(options);

  const { schema } = db;
  if (schema) {
    db.schema = undefined;
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      config.logger?.log(`Created schema ${schema}`);
    } catch (err) {
      if ((err as { code: string }).code === '42P06') {
        config.logger?.log(`Schema ${schema} already exists`);
      } else {
        throw err;
      }
    }
    db.schema = schema;
  }

  await createSchemaMigrations(db, config);
  await db.close();
};

export const createDb = async (
  arg: MaybeArray<AdapterOptions>,
  config: RakeDbConfig,
) => {
  for (const options of toArray(arg)) {
    await createOrDrop(options, options, config, {
      sql({ database, user }) {
        return `CREATE DATABASE "${database}" OWNER "${user}"`;
      },
      successMessage({ database }) {
        return `Database ${database} successfully created`;
      },
      alreadyMessage({ database }) {
        return `Database ${database} already exists`;
      },
      create: true,
    });
  }
};

export const dropDb = async (arg: MaybeArray<AdapterOptions>) => {
  for (const options of toArray(arg)) {
    await createOrDrop(options, options, migrationConfigDefaults, {
      sql({ database }) {
        return `DROP DATABASE "${database}"`;
      },
      successMessage({ database }) {
        return `Database ${database} was successfully dropped`;
      },
      alreadyMessage({ database }) {
        return `Database ${database} does not exist`;
      },
    });
  }
};

export const resetDb = async (
  arg: MaybeArray<AdapterOptions>,
  config: RakeDbConfig,
) => {
  await dropDb(arg);
  await createDb(arg, config);
  await migrate(arg, config);
};
