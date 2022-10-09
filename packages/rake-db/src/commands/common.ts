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

export const getFirstWordAndRest = (
  input: string,
): [string] | [string, string] => {
  const index = input.search(/(?=[A-Z])|[-_]/);
  if (index !== -1) {
    const restStart =
      input[index] === '-' || input[index] === '_' ? index + 1 : index;
    const rest = input.slice(restStart);
    return [input.slice(0, index), rest[0].toLowerCase() + rest.slice(1)];
  } else {
    return [input];
  }
};

const getTextAfterRegExp = (
  input: string,
  regex: RegExp,
  length: number,
): string | undefined => {
  let index = input.search(regex);
  if (index === -1) return;

  if (input[index] === '-' || input[index] === '_') index++;
  index += length;

  const start = input[index] == '-' || input[index] === '_' ? index + 1 : index;
  const text = input.slice(start);
  return text[0].toLowerCase() + text.slice(1);
};

export const getTextAfterTo = (input: string): string | undefined => {
  return getTextAfterRegExp(input, /(To|-to|_to)[A-Z-_]/, 2);
};

export const getTextAfterFrom = (input: string): string | undefined => {
  return getTextAfterRegExp(input, /(From|-from|_from)[A-Z-_]/, 4);
};
