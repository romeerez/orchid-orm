import { AdapterBase } from 'pqb';
import { promptConfirm, promptText } from '../prompt';
import {
  createDatabase,
  CreateOrDropError,
  CreateOrDropOk,
  createSchema,
  dropDatabase,
} from '../commands/create-or-drop';
import { migrate } from '../commands/migrate-or-rollback';
import { createMigrationsSchemaAndTable } from '../migration/manage-migrated-versions';
import { runRecurrentMigrations } from '../commands/recurrent';
import { RakeDbConfig } from '../config';

export const createDatabaseCommand = (
  adapters: AdapterBase[],
  config: RakeDbConfig,
  dontClose?: boolean,
): Promise<void> => createOrDropDatabase('create', adapters, config, dontClose);

export const dropDatabaseCommand = (
  adapters: AdapterBase[],
  config: RakeDbConfig,
): Promise<void> => createOrDropDatabase('drop', adapters, config);

export const createOrDropDatabase = async (
  action: 'create' | 'drop',
  adapters: AdapterBase[],
  config: RakeDbConfig,
  dontClose?: boolean,
): Promise<void> => {
  const fn = action === 'create' ? createDatabase : dropDatabase;

  for (const adapter of adapters) {
    const database = adapter.getDatabase();
    const owner = adapter.getUser();

    const res = await run(
      adapter.reconfigure({ database: 'postgres' }),
      config,
      {
        command: (adapter: AdapterBase) =>
          fn(adapter, {
            database,
            owner,
          }),
        doneMessage: () =>
          `Database ${database} successfully ${
            action === 'create' ? 'created' : 'dropped'
          }`,
        alreadyMessage: () =>
          `Database ${database} ${
            action === 'create' ? 'already exists' : 'does not exist'
          }`,
        deniedMessage: () => `Permission denied to ${action} database.`,
        askAdminCreds: () => askForAdminCredentials(action === 'create'),
      },
    );

    if (!res) continue;

    if (action === 'create') {
      await adapter.transaction(undefined, async (tx) => {
        if (config.schema) {
          const quoted = `"${config.schema}"`;
          const res = await createSchema(tx, quoted);
          if (res === 'done') {
            config.logger?.log(`Created schema ${quoted}`);
          }
        }

        await createMigrationsSchemaAndTable(tx, config);
      });

      if (!dontClose) {
        await adapter.close();
      }
    }
  }
};

export const resetDatabaseCommand = async (
  adapters: AdapterBase[],
  config: RakeDbConfig,
) => {
  await createOrDropDatabase('create', adapters, config);
  await createOrDropDatabase('drop', adapters, config, true);
  for (const adapter of adapters) {
    await migrate(adapter, config);
  }
  if (config.recurrentPath) {
    await runRecurrentMigrations(adapters, config as { recurrentPath: string });
  }
  await Promise.all(adapters.map((adapter) => adapter.close()));
};

const run = async (
  adapter: AdapterBase,
  config: RakeDbConfig,
  params: {
    command: (adapter: AdapterBase) => Promise<CreateOrDropOk>;
    doneMessage(): string;
    alreadyMessage(): string;
    deniedMessage(): string;
    askAdminCreds(): Promise<{ user: string; password?: string } | undefined>;
  },
): Promise<boolean> => {
  try {
    const res = await params.command(adapter);
    config.logger?.log(
      res === 'done' ? params.doneMessage() : params.alreadyMessage(),
    );
    await adapter.close();
    return true;
  } catch (err) {
    if (err instanceof CreateOrDropError) {
      if (err.status === 'ssl-required') {
        config.logger?.log(
          'SSL is required: append ?ssl=true to the database url string',
        );
        return false;
      }

      if (err.status === 'forbidden' || err.status === 'auth-failed') {
        let message = params.deniedMessage();
        const host = adapter.getHost();
        const isLocal = host === 'localhost';
        if (!isLocal) {
          message += `\nDon't use this command for database service providers, only for a local db.`;
        }
        config.logger?.log(message);

        const creds = await params.askAdminCreds();
        if (!creds) return false;

        return run(adapter.reconfigure(creds), config, params);
      }
    }

    throw err;
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
