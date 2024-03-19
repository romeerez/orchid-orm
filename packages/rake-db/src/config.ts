import {
  AdapterOptions,
  DbResult,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  makeColumnTypes as defaultColumnTypes,
  NoPrimaryKeyOption,
  QueryLogOptions,
} from 'pqb';
import { ColumnSchemaConfig, getStackTrace } from 'orchid-core';
import path from 'path';
import { RakeDbAst } from './ast';
import { fileURLToPath } from 'node:url';
import { RakeDbColumnTypes } from './migration/migration';

export interface RakeDbConfig<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> extends QueryLogOptions {
  schemaConfig: SchemaConfig;
  columnTypes: CT;
  basePath: string;
  dbScript: string;
  migrationsPath: string;
  migrationId: RakeDbMigrationId;
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
  baseTable?: RakeDbBaseTable<CT>;
  appCodeUpdater?: AppCodeUpdater;
  useCodeUpdater?: boolean;
  // throw if a migration doesn't have a default export
  forceDefaultExports?: boolean;
  import(path: string): Promise<unknown>;
  beforeMigrate?(db: Db): Promise<void>;
  afterMigrate?(db: Db): Promise<void>;
  beforeRollback?(db: Db): Promise<void>;
  afterRollback?(db: Db): Promise<void>;
}

export interface InputRakeDbConfig<SchemaConfig extends ColumnSchemaConfig, CT>
  extends QueryLogOptions {
  columnTypes?: CT | ((t: DefaultColumnTypes<DefaultSchemaConfig>) => CT);
  baseTable?: RakeDbBaseTable<CT>;
  schemaConfig?: SchemaConfig;
  basePath?: string;
  dbScript?: string;
  migrationsPath?: string;
  migrationId?: RakeDbMigrationId;
  migrations?: ModuleExportsRecord;
  recurrentPath?: string;
  migrationsTable?: string;
  snakeCase?: boolean;
  language?: string;
  commands?: Record<
    string,
    (
      options: AdapterOptions[],
      config: RakeDbConfig<
        SchemaConfig,
        CT extends undefined ? DefaultColumnTypes<DefaultSchemaConfig> : CT
      >,
      args: string[],
    ) => void | Promise<void>
  >;
  noPrimaryKey?: NoPrimaryKeyOption;
  appCodeUpdater?: AppCodeUpdater;
  useCodeUpdater?: boolean;
  forceDefaultExports?: boolean;
  import?(path: string): Promise<unknown>;
  beforeMigrate?(db: Db): Promise<void>;
  afterMigrate?(db: Db): Promise<void>;
  beforeRollback?(db: Db): Promise<void>;
  afterRollback?(db: Db): Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRakeDbConfig = RakeDbConfig<any, any>;

type Db = DbResult<RakeDbColumnTypes>;

export interface RakeDbBaseTable<CT> {
  exportAs: string;

  getFilePath(): string;

  nowSQL?: string;

  new (): {
    types: CT;
    snakeCase?: boolean;
    language?: string;
  };
}

export interface ModuleExportsRecord {
  [K: string]: () => Promise<unknown>;
}

export type RakeDbMigrationId = 'serial' | 'timestamp';

export interface AppCodeUpdaterParams {
  options: AdapterOptions;
  basePath: string;
  cache: object;
  logger: QueryLogOptions['logger'];
  baseTable: { getFilePath(): string; exportAs: string };

  import(path: string): Promise<unknown>;
}

export interface AppCodeUpdater {
  process(params: AppCodeUpdaterParams & { ast: RakeDbAst }): Promise<void>;

  afterAll(params: AppCodeUpdaterParams): Promise<void>;
}

export const migrationConfigDefaults = {
  schemaConfig: defaultSchemaConfig,
  migrationsPath: path.join('src', 'db', 'migrations'),
  migrationId: 'serial',
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
