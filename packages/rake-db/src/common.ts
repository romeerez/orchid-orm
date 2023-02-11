import {
  Adapter,
  AdapterOptions,
  DbResult,
  DefaultColumnTypes,
  EnumColumn,
  NoPrimaryKeyOption,
  QueryLogOptions,
  singleQuote,
} from 'pqb';
import path from 'path';
import { readdir } from 'fs/promises';
import { RakeDbAst } from './ast';
import prompts from 'prompts';
import { TableQuery } from './migration/createTable';

type Db = DbResult<DefaultColumnTypes>;

export type RakeDbConfig = {
  basePath: string;
  migrationsPath: string;
  migrationsTable: string;
  commands: Record<
    string,
    (
      options: AdapterOptions[],
      config: RakeDbConfig,
      args: string[],
    ) => Promise<void>
  >;
  import(path: string): Promise<void>;
  noPrimaryKey?: NoPrimaryKeyOption;
  appCodeUpdater?: AppCodeUpdater;
  useCodeUpdater?: boolean;
  beforeMigrate?(db: Db): Promise<void>;
  afterMigrate?(db: Db): Promise<void>;
  beforeRollback?(db: Db): Promise<void>;
  afterRollback?(db: Db): Promise<void>;
} & QueryLogOptions;

export type AppCodeUpdater = (params: {
  ast: RakeDbAst;
  options: AdapterOptions;
  basePath: string;
  cache: object;
}) => Promise<void>;

export const migrationConfigDefaults: Omit<RakeDbConfig, 'basePath'> = {
  migrationsPath: path.join('src', 'db', 'migrations'),
  migrationsTable: 'schemaMigrations',
  commands: {},
  import: (path: string) => import(path),
  log: true,
  logger: console,
  useCodeUpdater: true,
};

export const processRakeDbConfig = (
  config: Partial<RakeDbConfig>,
): RakeDbConfig => {
  const result = { ...migrationConfigDefaults, ...config };

  if (!result.basePath) {
    let stack: NodeJS.CallSite[] | undefined;
    Error.prepareStackTrace = (_, s) => (stack = s);
    new Error().stack;
    if (stack) {
      const thisFile = stack[0]?.getFileName();
      const thisDir = thisFile && path.dirname(thisFile);
      for (const item of stack) {
        let file = item.getFileName();
        if (
          !file ||
          path.dirname(file) === thisDir ||
          /\bnode_modules\b/.test(file)
        ) {
          continue;
        }

        // on Windows with ESM file is file:///C:/path/to/file.ts
        // it is not a valid URL
        if (/file:\/\/\/\w+:\//.test(file)) {
          file = decodeURI(file.slice(8));
        } else {
          try {
            file = new URL(file).pathname;
          } catch (_) {}
        }

        result.basePath = path.dirname(file);
        break;
      }
    }

    if (!result.basePath) {
      throw new Error(
        'Failed to determine path to db script. Please set basePath option of rakeDb',
      );
    }
  }

  if (!path.isAbsolute(result.migrationsPath)) {
    result.migrationsPath = path.resolve(
      result.basePath,
      result.migrationsPath,
    );
  }

  return result as RakeDbConfig;
};

export const getDatabaseAndUserFromOptions = (
  options: AdapterOptions,
): { database: string; user: string } => {
  if (options.databaseURL) {
    const url = new URL(options.databaseURL);
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
  if (options.databaseURL) {
    const url = new URL(options.databaseURL);

    if ('database' in set) {
      url.pathname = `/${set.database}`;
    }

    if (set.user !== undefined) {
      url.username = set.user;
    }

    if (set.password !== undefined) {
      url.password = set.password;
    }

    return { ...options, databaseURL: url.toString() };
  } else {
    return {
      ...options,
      ...set,
    };
  }
};

export const setAdminCredentialsToOptions = async (
  options: AdapterOptions,
  create?: boolean,
): Promise<AdapterOptions | undefined> => {
  const confirm = await prompts([
    {
      message: `Would you like to share admin credentials to ${
        create ? 'create' : 'drop'
      } a database`,
      type: 'confirm',
      name: 'confirm',
      initial: true,
    },
  ]);

  if (!confirm.confirm) {
    return;
  }

  const values = await prompts([
    {
      message: 'Enter admin user:',
      type: 'text',
      name: 'user',
      initial: 'postgres',
      min: 1,
    },
    {
      message: 'Enter admin password:',
      type: 'password',
      name: 'password',
    },
  ]);

  return setAdapterOptions(options, {
    ...values,
    password: values.password || undefined,
  });
};

export const createSchemaMigrations = async (
  db: Adapter,
  config: Pick<RakeDbConfig, 'migrationsTable'>,
) => {
  try {
    await db.query(
      `CREATE TABLE ${quoteWithSchema({
        name: config.migrationsTable,
      })} ( version TEXT NOT NULL )`,
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

export type MigrationFile = {
  path: string;
  version: string;
};

export const getMigrationFiles = async (
  config: RakeDbConfig,
  up: boolean,
): Promise<MigrationFile[]> => {
  const { migrationsPath } = config;

  let files: string[];
  try {
    files = await readdir(migrationsPath);
  } catch (_) {
    return [];
  }

  const sort = up ? sortAsc : sortDesc;
  return sort(files).map((file) => {
    if (!file.endsWith('.ts')) {
      throw new Error(
        `Only .ts files are supported for migration, received: ${file}`,
      );
    }

    const timestampMatch = file.match(/^(\d{14})\D/);
    if (!timestampMatch) {
      throw new Error(
        `Migration file name should start with 14 digit version, received ${file}`,
      );
    }

    return {
      path: path.resolve(migrationsPath, file),
      version: timestampMatch[1],
    };
  });
};

export const sortAsc = (arr: string[]) => arr.sort();

export const sortDesc = (arr: string[]) => arr.sort((a, b) => (a > b ? -1 : 1));

export const joinWords = (...words: string[]) => {
  return words
    .slice(1)
    .reduce(
      (acc, word) => acc + word[0].toUpperCase() + word.slice(1),
      words[0],
    );
};

export const joinColumns = (columns: string[]) => {
  return columns.map((column) => `"${column}"`).join(', ');
};

export const quoteWithSchema = ({
  schema,
  name,
}: {
  schema?: string;
  name: string;
}) => {
  return schema ? `"${schema}"."${name}"` : `"${name}"`;
};

export const getSchemaAndTableFromName = (
  name: string,
): [string | undefined, string] => {
  const index = name.indexOf('.');
  return index !== -1
    ? [name.slice(0, index), name.slice(index + 1)]
    : [undefined, name];
};

export const quoteSchemaTable = ({
  schema,
  name,
}: {
  schema?: string;
  name: string;
}) => {
  return singleQuote(schema ? `${schema}.${name}` : name);
};

export const makePopulateEnumQuery = (item: EnumColumn): TableQuery => {
  const [schema, name] = getSchemaAndTableFromName(item.enumName);
  return {
    text: `SELECT unnest(enum_range(NULL::${quoteWithSchema({
      schema,
      name,
    })}))::text`,
    then(result) {
      // populate empty options array with values from db
      item.options.push(...result.rows.map(([value]) => value));
    },
  };
};
