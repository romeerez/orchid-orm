import { Adapter, AdapterOptions } from 'pqb';
import Enquirer from 'enquirer';
import path from 'path';

export type MigrationConfig = {
  migrationsPath: string;
  migrationsTable: string;
};

export const migrationConfigDefaults = {
  migrationsPath: path.resolve(process.cwd(), 'src', 'migrations'),
  migrationsTable: 'schemaMigrations',
};

export const getMigrationConfigWithDefaults = (
  config: Partial<MigrationConfig>,
) => {
  return { ...migrationConfigDefaults, ...config };
};

export const getDatabaseAndUserFromOptions = (
  options: AdapterOptions,
): { database: string; user: string } => {
  if (options.connectionString) {
    const url = new URL(options.connectionString);
    return {
      database: url.pathname.slice(1),
      user: url.username,
    };
  } else {
    return {
      database: options.database as string,
      user: options.user as string,
    };
  }
};

export const setAdapterOptions = (
  options: AdapterOptions,
  set: { database?: string; user?: string; password?: string },
): AdapterOptions => {
  if (options.connectionString) {
    const url = new URL(options.connectionString);

    if ('database' in set) {
      url.pathname = `/${set.database}`;
    }

    if (set.user !== undefined) {
      url.username = set.user;
    }

    if (set.password !== undefined) {
      url.password = set.password;
    }

    return { ...options, connectionString: url.toString() };
  } else {
    return {
      ...options,
      ...set,
    };
  }
};

const askAdminCredentials = async (): Promise<{
  user: string;
  password: string;
}> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prompt = new (Enquirer as any).Snippet({
    message: `What are postgres admin login and password?`,
    fields: [
      {
        name: 'user',
        required: true,
      },
      {
        name: 'password',
      },
    ],
    values: {
      user: 'postgres',
      password: '',
    },
    template: 'Admin user: {{user}}\nAdmin password: {{password}}',
  });

  const { values } = await prompt.run();
  if (!values.password) values.password = '';

  return values;
};

export const setAdminCredentialsToOptions = async (
  options: AdapterOptions,
): Promise<AdapterOptions> => {
  const values = await askAdminCredentials();
  return setAdapterOptions(options, values);
};

export const createSchemaMigrations = async (
  db: Adapter,
  config: MigrationConfig,
) => {
  try {
    await db.query(
      `CREATE TABLE "${config.migrationsTable}" ( version TEXT NOT NULL )`,
    );
    console.log('Created versions table');
  } catch (err) {
    if ((err as Record<string, unknown>).code === '42P07') {
      console.log('Versions table exists');
    } else {
      throw err;
    }
  }
};
