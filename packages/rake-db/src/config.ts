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
import { ColumnSchemaConfig, getStackTrace, MaybePromise } from 'orchid-core';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { MigrationItem } from './migration/migrationsSet';

export type CommandFn<SchemaConfig extends ColumnSchemaConfig, CT> = (
  options: AdapterOptions[],
  config: RakeDbConfig<SchemaConfig, CT>,
  args: string[],
) => void | Promise<void>;

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
  renameMigrations?: RakeDbRenameMigrationsInput;
  recurrentPath: string;
  migrationsTable: string;
  snakeCase: boolean;
  language?: string;
  commands: Record<string, CommandFn<SchemaConfig, CT>>;
  noPrimaryKey?: NoPrimaryKeyOption;
  baseTable?: RakeDbBaseTable<CT>;
  // throw if a migration doesn't have a default export
  forceDefaultExports?: boolean;
  import(path: string): Promise<unknown>;
  beforeChange?: ChangeCallback;
  afterChange?: ChangeCallback;
  afterChangeCommit?: ChangeCommitCallback;
  beforeMigrate?: MigrationCallback;
  afterMigrate?: MigrationCallback;
  beforeRollback?: MigrationCallback;
  afterRollback?: MigrationCallback;
}

export interface InputRakeDbConfigBase<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
> extends QueryLogOptions {
  columnTypes?: CT | ((t: DefaultColumnTypes<DefaultSchemaConfig>) => CT);
  baseTable?: RakeDbBaseTable<CT>;
  schemaConfig?: SchemaConfig;
  basePath?: string;
  dbScript?: string;
  migrationsPath?: string;
  migrationId?: 'serial' | RakeDbMigrationId;
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
  forceDefaultExports?: boolean;
  /**
   * Is called once per db before migrating or rolling back a set of migrations.
   *
   * @param arg.db - query builder
   * @param arg.up - whether it's migrating up or down
   * @param arg.redo - whether it's migrating down and then up for `redo` command
   * @param arg.migrations - array of executed (up or down) migrations
   */
  beforeChange?: ChangeCallback;
  /**
   * Is called once per db after migrating or rolling back a set of migrations.
   * Runs inside the same transaction as migrations,
   * for running after commit use {@link afterChangeCommit}.
   *
   * @param arg.db - query builder
   * @param arg.up - whether it's migrating up or down
   * @param arg.redo - whether it's migrating down and then up for `redo` command
   * @param arg.migrations - array of executed (up or down) migrations
   */
  afterChange?: ChangeCallback;
  /**
   * Is called once per db after migrating or rolling back a set of migrations.
   * Runs **after** committing migrations transaction.
   *
   * @param arg.options - database connection options
   * @param arg.up - whether it's migrating up or down
   * @param arg.migrations - array of executed (up or down) migrations
   */
  afterChangeCommit?: ChangeCommitCallback;
  /**
   * Is called once per db before migrating (up) a set of migrations.
   *
   * @param arg.db - query builder
   * @param arg.migrations - applied migrations
   */
  beforeMigrate?: MigrationCallback;
  /**
   * Is called once per db after migrating (up) a set of migrations.
   *
   * @param arg.db - query builder
   * @param arg.migrations - applied migrations
   */
  afterMigrate?: MigrationCallback;
  /**
   * Is called once per db before rolling back a set of migrations.
   *
   * @param arg.db - query builder
   * @param arg.migrations - rolled back migrations
   */
  beforeRollback?: MigrationCallback;
  /**
   * Is called once per db before rolling back a set of migrations.
   *
   * @param arg.db - query builder
   * @param arg.migrations - rolled back migrations
   */
  afterRollback?: MigrationCallback;
}

export type InputRakeDbConfig<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
> = InputRakeDbConfigBase<SchemaConfig, CT> &
  // make `import` required only when not using `migrations`
  (| {
        /**
         * It may look odd, but it's required for `tsx` and other bundlers to have such `import` config specified explicitly.
         */
        import(path: string): Promise<unknown>;
      }
    | {
        /**
         * To specify array of migrations explicitly, without loading them from files.
         */
        migrations: ModuleExportsRecord;
        renameMigrations?: RakeDbRenameMigrationsInput;
        /**
         * It may look odd, but it's required for `tsx` and other bundlers to have such `import` config specified explicitly.
         */
        import?(path: string): Promise<unknown>;
      }
  );

type ChangeCallback = (arg: {
  db: Db;
  up: boolean;
  redo: boolean;
  migrations: MigrationItem[];
}) => void | Promise<void>;

type ChangeCommitCallback = (arg: {
  options: AdapterOptions;
  up: boolean;
  migrations: MigrationItem[];
}) => void | Promise<void>;

type MigrationCallback = (arg: {
  db: Db;
  migrations: MigrationItem[];
}) => void | Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRakeDbConfig = RakeDbConfig<any, any>;

type Db = DbResult<unknown>;

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

export type RakeDbMigrationId = 'timestamp' | { serial: number };

export interface RakeDbRenameMigrationsMap {
  [K: string]: number;
}

export interface RakeDbRenameMigrations {
  to: RakeDbMigrationId;
  map(): MaybePromise<RakeDbRenameMigrationsMap>;
}

export interface RakeDbRenameMigrationsInput {
  to: RakeDbMigrationId;
  map: RakeDbRenameMigrationsMap;
}

export const migrationConfigDefaults = {
  schemaConfig: defaultSchemaConfig,
  migrationsPath: path.join('src', 'db', 'migrations'),
  migrationId: { serial: 4 },
  migrationsTable: 'schemaMigrations',
  snakeCase: false,
  commands: {},
  log: true,
  logger: console,
  import() {
    throw new Error('Please define the `import` setting in `rakeDb` config');
  },
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

  if ('baseTable' in config && config.baseTable) {
    const { types, snakeCase, language } = config.baseTable.prototype;
    result.columnTypes = types || defaultColumnTypes(defaultSchemaConfig);
    if (snakeCase) result.snakeCase = true;
    if (language) result.language = language;
  } else {
    const ct = 'columnTypes' in config && config.columnTypes;
    result.columnTypes = ((typeof ct === 'function'
      ? (ct as (t: DefaultColumnTypes<ColumnSchemaConfig>) => CT)(
          defaultColumnTypes(defaultSchemaConfig),
        )
      : ct) || defaultColumnTypes(defaultSchemaConfig)) as CT;
  }

  if (config.migrationId === 'serial') {
    result.migrationId = { serial: 4 };
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
