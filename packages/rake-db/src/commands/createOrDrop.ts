import { AdapterBase, ColumnSchemaConfig, RecordUnknown } from 'orchid-core';
import { migrateAndClose } from './migrateOrRollback';
import { RakeDbConfig } from '../config';
import { createMigrationsTable } from '../migration/migrationsTable';
import { promptConfirm, promptText } from '../prompt';

const execute = async (
  adapter: AdapterBase,
  sql: string,
): Promise<
  'ok' | 'already' | 'forbidden' | 'ssl required' | { error: unknown }
> => {
  try {
    await adapter.query(sql);
    return 'ok';
  } catch (error) {
    const err = error as RecordUnknown;

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
    await adapter.close();
  }
};

const createOrDrop = async (
  adapter: AdapterBase,
  adminAdapter: AdapterBase,
  config: Pick<RakeDbConfig<ColumnSchemaConfig>, 'migrationsTable' | 'logger'>,
  args: {
    sql(params: { database: string; user: string }): string;
    successMessage(params: { database: string }): string;
    alreadyMessage(params: { database: string }): string;
    create?: boolean;
  },
) => {
  const params = {
    database: adapter.getDatabase(),
    user: adapter.getUser(),
  };

  const result = await execute(
    adminAdapter.reconfigure({ database: 'postgres' }),
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

    const host = adminAdapter.getHost();

    const isLocal = host === 'localhost';
    if (!isLocal) {
      message += `\nDon't use this command for database service providers, only for a local db.`;
    }

    config.logger?.log(message);

    const params = await askForAdminCredentials(args.create);
    if (!params) return;

    await createOrDrop(adapter, adminAdapter.reconfigure(params), config, args);
    return;
  } else {
    throw result.error;
  }

  if (!args.create) return;

  const newlyConnectedAdapter = adapter.reconfigure({});

  await createMigrationsTable(newlyConnectedAdapter, config);
  await newlyConnectedAdapter.close();
};

export const createDb = async <SchemaConfig extends ColumnSchemaConfig, CT>(
  adapters: AdapterBase[],
  config: RakeDbConfig<SchemaConfig, CT>,
) => {
  for (const adapter of adapters) {
    await createOrDrop(adapter, adapter, config, {
      sql({ database, user }) {
        return `CREATE DATABASE "${database}"${user ? ` OWNER "${user}"` : ''}`;
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

export const dropDb = async <SchemaConfig extends ColumnSchemaConfig, CT>(
  adapters: AdapterBase[],
  config: RakeDbConfig<SchemaConfig, CT>,
) => {
  for (const adapter of adapters) {
    await createOrDrop(adapter, adapter, config, {
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

export const resetDb = async <SchemaConfig extends ColumnSchemaConfig, CT>(
  adapters: AdapterBase[],
  config: RakeDbConfig<SchemaConfig, CT>,
) => {
  await dropDb(adapters, config);
  await createDb(adapters, config);
  for (const adapter of adapters) {
    await migrateAndClose({ adapter, config });
  }
};

export const askForAdminCredentials = async (
  create?: boolean,
): Promise<{ user: string; password?: string } | undefined> => {
  const ok = await promptConfirm({
    message: `Would you like to share admin credentials to ${
      create ? 'create' : 'drop'
    } a database?`,
  });

  if (!ok) {
    return;
  }

  const user = await promptText({
    message: 'Enter admin user:',
    default: 'postgres',
    min: 1,
  });

  const password = await promptText({
    message: 'Enter admin password:',
    password: true,
  });

  return {
    user,
    password: password || undefined,
  };
};
