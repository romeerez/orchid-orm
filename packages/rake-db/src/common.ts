import {
  Adapter,
  AdapterOptions,
  makeColumnTypes as defaultColumnTypes,
  DbResult,
  DefaultColumnTypes,
  EnumColumn,
  NoPrimaryKeyOption,
  QueryLogOptions,
  IndexColumnOptions,
  IndexOptions,
  ForeignKeyOptions,
  defaultSchemaConfig,
} from 'pqb';
import {
  ColumnSchemaConfig,
  EmptyObject,
  getStackTrace,
  MaybeArray,
  RawSQLBase,
  singleQuote,
} from 'orchid-core';
import path from 'path';
import { readdir } from 'fs/promises';
import { RakeDbAst } from './ast';
import prompts from 'prompts';
import { TableQuery } from './migration/createTable';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { DropMode } from './migration/migration';

export type RakeDbColumnTypes = {
  index(
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ): EmptyObject;

  foreignKey(
    columns: [string, ...string[]],
    foreignTable: string,
    foreignColumns: [string, ...string[]],
    options?: ForeignKeyOptions,
  ): EmptyObject;

  primaryKey(columns: string[], options?: { name?: string }): EmptyObject;

  check(check: RawSQLBase): EmptyObject;

  constraint(arg: ConstraintArg): EmptyObject;
};

// Constraint config, it can be a foreign key or a check
export type ConstraintArg = {
  // Name of the constraint
  name?: string;
  // Foreign key options
  references?: [
    columns: [string, ...string[]],
    table: string,
    foreignColumn: [string, ...string[]],
    options: Omit<ForeignKeyOptions, 'name' | 'dropMode'>,
  ];
  // Database check raw SQL
  check?: RawSQLBase;
  // Drop mode to use when dropping the constraint
  dropMode?: DropMode;
};

type Db = DbResult<RakeDbColumnTypes>;

type BaseTable<CT> = {
  exportAs: string;
  getFilePath(): string;
  nowSQL?: string;

  new (): {
    types: CT;
    snakeCase?: boolean;
    language?: string;
  };
};

export type InputRakeDbConfig<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
> = Partial<Omit<RakeDbConfig<SchemaConfig, CT>, 'columnTypes'>> &
  (
    | {
        columnTypes?: CT | ((t: DefaultColumnTypes<ColumnSchemaConfig>) => CT);
      }
    | {
        baseTable?: BaseTable<CT>;
      }
  );

export type RakeDbConfig<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<ColumnSchemaConfig>,
> = {
  schemaConfig: SchemaConfig;
  columnTypes: CT;
  basePath: string;
  dbScript: string;
  migrationsPath: string;
  migrations?: ModuleExportsRecord;
  recurrentPath: string;
  migrationsTable: string;
  snakeCase: boolean;
  language?: string;
  commands: Record<
    string,
    (
      options: AdapterOptions[],
      config: RakeDbConfig<SchemaConfig, CT>,
      args: string[],
    ) => void | Promise<void>
  >;
  noPrimaryKey?: NoPrimaryKeyOption;
  baseTable?: BaseTable<CT>;
  appCodeUpdater?: AppCodeUpdater;
  useCodeUpdater?: boolean;
  // throw if a migration doesn't have a default export
  forceDefaultExports?: boolean;
  import(path: string): Promise<unknown>;
  beforeMigrate?(db: Db): Promise<void>;
  afterMigrate?(db: Db): Promise<void>;
  beforeRollback?(db: Db): Promise<void>;
  afterRollback?(db: Db): Promise<void>;
} & QueryLogOptions;

export type ModuleExportsRecord = Record<string, () => Promise<unknown>>;

export type AppCodeUpdaterParams = {
  options: AdapterOptions;
  basePath: string;
  cache: object;
  logger: QueryLogOptions['logger'];
  baseTable: { getFilePath(): string; exportAs: string };
  import(path: string): Promise<unknown>;
};

export type AppCodeUpdater = {
  process(params: AppCodeUpdaterParams & { ast: RakeDbAst }): Promise<void>;
  afterAll(params: AppCodeUpdaterParams): Promise<void>;
};

export const migrationConfigDefaults = {
  schemaConfig: defaultSchemaConfig,
  migrationsPath: path.join('src', 'db', 'migrations'),
  migrationsTable: 'schemaMigrations',
  snakeCase: false,
  commands: {},
  import: (path: string) => {
    return import(path).catch((err) => {
      if (err.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
        require(path);
      } else {
        throw err;
      }
    });
  },
  log: true,
  logger: console,
  useCodeUpdater: true,
} satisfies Omit<
  RakeDbConfig<ColumnSchemaConfig>,
  'basePath' | 'dbScript' | 'columnTypes' | 'recurrentPath'
>;

export const processRakeDbConfig = <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  config: InputRakeDbConfig<SchemaConfig, CT>,
): RakeDbConfig<SchemaConfig, CT> => {
  const result = { ...migrationConfigDefaults, ...config } as RakeDbConfig<
    SchemaConfig,
    CT
  >;
  if (!result.recurrentPath) {
    result.recurrentPath = path.join(result.migrationsPath, 'recurrent');
  }

  if (
    config.appCodeUpdater &&
    (!('baseTable' in config) || !config.baseTable)
  ) {
    throw new Error(
      '`baseTable` option is required in `rakeDb` for `appCodeUpdater`',
    );
  }

  if (!result.log) {
    delete result.logger;
  }

  if (!result.basePath || !result.dbScript) {
    // 0 is getStackTrace file, 1 is this function, 2 is a caller in rakeDb.ts, 3 is the user db script file.
    // bundlers can bundle all files into a single file, or change file structure, so this must rely only on the caller index.
    let filePath = getStackTrace()?.[3].getFileName();
    if (!filePath) {
      throw new Error(
        'Failed to determine path to db script. Please set basePath option of rakeDb',
      );
    }

    if (filePath.startsWith('file://')) {
      filePath = fileURLToPath(filePath);
    }

    const ext = path.extname(filePath);
    if (ext !== '.ts' && ext !== '.js' && ext !== '.mjs') {
      throw new Error(
        `Add a .ts suffix to the "${path.basename(filePath)}" when calling it`,
      );
    }

    result.basePath = path.dirname(filePath);
    result.dbScript = path.basename(filePath);
  }

  if ('migrationsPath' in result && !path.isAbsolute(result.migrationsPath)) {
    result.migrationsPath = path.resolve(
      result.basePath,
      result.migrationsPath,
    );
  }

  if ('recurrentPath' in result && !path.isAbsolute(result.recurrentPath)) {
    result.recurrentPath = path.resolve(result.basePath, result.recurrentPath);
  }

  if ('baseTable' in config) {
    const proto = config.baseTable?.prototype;
    result.columnTypes = proto.types || defaultColumnTypes(defaultSchemaConfig);
    if (proto.snakeCase) result.snakeCase = true;
    if (proto.language) result.language = proto.language;
  } else {
    const ct = 'columnTypes' in config && config.columnTypes;
    result.columnTypes = ((typeof ct === 'function'
      ? (ct as (t: DefaultColumnTypes<ColumnSchemaConfig>) => CT)(
          defaultColumnTypes(defaultSchemaConfig),
        )
      : ct) || defaultColumnTypes) as CT;
  }

  return result as RakeDbConfig<SchemaConfig, CT>;
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
  config: Pick<RakeDbConfig<ColumnSchemaConfig>, 'migrationsTable' | 'logger'>,
) => {
  const { schema } = db;
  if (schema && schema !== 'public') {
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      config.logger?.log(`Created schema ${schema}`);
    } catch (err) {
      if ((err as { code: string }).code !== '42P06') {
        throw err;
      }
    }
  }

  try {
    await db.query(
      `CREATE TABLE ${quoteWithSchema({
        name: config.migrationsTable,
      })} ( version TEXT NOT NULL )`,
    );
    config.logger?.log('Created versions table');
  } catch (err) {
    if ((err as Record<string, unknown>).code === '42P07') {
      config.logger?.log('Versions table exists');
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

export type MigrationItem = {
  path: string;
  version: string;
  /**
   * Function that loads the migration content,
   * can store lazy import of a migration file.
   * Promise can return `{ default: x }` where `x` is a return of `change` or an array of such returns.
   */
  load(): Promise<unknown>;
};

// If the config has a `migrations` object, it will be returned as array of migration items.
// If `up` is false, will reverse the resulting array.
// Otherwise, it will scan directory which is set in `migrationPath` and convert files into migration items.
// `up` value determines sorting of files: `true` for ascending, `false` for descending.
export const getMigrations = async (
  {
    migrations,
    ...config
  }: Pick<
    RakeDbConfig<ColumnSchemaConfig>,
    'basePath' | 'migrations' | 'migrationsPath' | 'import'
  >,
  up: boolean,
): Promise<MigrationItem[]> => {
  return migrations
    ? getMigrationsFromConfig({ ...config, migrations }, up)
    : getMigrationsFromFiles(config, up);
};

// Converts user-provided migrations object into array of migration items.
function getMigrationsFromConfig(
  config: { basePath: string; migrations: ModuleExportsRecord },
  up: boolean,
): MigrationItem[] {
  const result: MigrationItem[] = [];

  const { migrations, basePath } = config;
  for (const key in migrations) {
    result.push({
      path: path.resolve(basePath, key),
      version: getVersion(path.basename(key)),
      load: migrations[key],
    });
  }

  return up ? result : result.reverse();
}

// Scans files under `migrationsPath` to convert files into migration items.
async function getMigrationsFromFiles(
  config: Pick<RakeDbConfig<ColumnSchemaConfig>, 'migrationsPath' | 'import'>,
  up: boolean,
): Promise<MigrationItem[]> {
  const { migrationsPath, import: imp } = config;

  let files: string[];
  try {
    files = await readdir(migrationsPath);
  } catch (_) {
    return [];
  }

  files = files.filter((file) => path.basename(file).includes('.'));
  files = (up ? sortAsc : sortDesc)(files);

  return files.map((file) => {
    checkExt(file);

    const filePath = path.resolve(migrationsPath, file);
    return {
      path: filePath,
      version: getVersion(file),
      async load() {
        try {
          await imp(filePath);
        } catch (err) {
          // throw if unknown error
          if (
            (err as { code: string }).code !== 'ERR_UNSUPPORTED_ESM_URL_SCHEME'
          )
            throw err;

          // this error happens on windows in ESM mode, try import transformed url
          await imp(pathToFileURL(filePath).pathname);
        }
      },
    };
  });
}

// Restrict supported file extensions to `.ts`, `.js`, and `.mjs`.
function checkExt(filePath: string): void {
  const ext = path.extname(filePath);
  if (ext !== '.ts' && ext !== '.js' && ext !== '.mjs') {
    throw new Error(
      `Only .ts, .js, and .mjs files are supported for migration, received: ${path}`,
    );
  }
}

// Extract a 14-chars long timestamp from a beginning of a file name.
function getVersion(path: string): string {
  const timestampMatch = path.match(/^(\d{14})\D/);
  if (!timestampMatch) {
    throw new Error(
      `Migration file name should start with 14 digit version, received ${path}`,
    );
  }

  return timestampMatch[1];
}

// Just a default ascending sort.
export const sortAsc = (arr: string[]) => arr.sort();

// Reverse sort order, higher goes first.
export const sortDesc = (arr: string[]) => arr.sort((a, b) => (a > b ? -1 : 1));

// Join array of strings into a camelCased string.
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

export const quoteNameFromString = (string: string) => {
  const [schema, name] = getSchemaAndTableFromName(string);
  return quoteWithSchema({ schema, name });
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

export const makePopulateEnumQuery = (
  item: EnumColumn<ColumnSchemaConfig, unknown>,
): TableQuery => {
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
