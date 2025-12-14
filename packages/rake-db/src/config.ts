import {
  DbResult,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  makeColumnTypes as defaultColumnTypes,
  NoPrimaryKeyOption,
  AdapterBase,
  ColumnSchemaConfig,
  getStackTrace,
  MaybePromise,
  QueryLogOptions,
} from 'pqb';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { MigrationItem } from './migration/migrationsSet';
import { getCliParam } from './common';

export interface CommandFn<SchemaConfig extends ColumnSchemaConfig, CT> {
  (
    adapters: AdapterBase[],
    config: RakeDbConfig<SchemaConfig, CT>,
    args: string[],
  ): void | Promise<void>;
}

export interface PickBasePath {
  basePath: string;
}

export interface PickImport {
  import(path: string): Promise<unknown>;
}

export interface PickMigrationId {
  migrationId: RakeDbMigrationId;
}

export interface PickMigrations {
  migrations?: ModuleExportsRecord;
}

export interface PickMigrationsPath {
  migrationsPath: string;
}

export interface PickOptionalMigrationsPath {
  migrationsPath?: string;
}

export interface PickRenameMigrations {
  renameMigrations?: RakeDbRenameMigrationsInput;
}

export interface PickMigrationsTable {
  migrationsTable: string;
}

export interface PickTransactionSetting {
  transaction: 'single' | 'per-migration';
}

export interface PickMigrationCallbacks {
  beforeChange?: ChangeCallback;
  afterChange?: ChangeCallback;
  beforeMigrate?: MigrationCallback;
  afterMigrate?: MigrationCallback;
  beforeRollback?: MigrationCallback;
  afterRollback?: MigrationCallback;
}

export interface PickAfterChangeCommit {
  afterChangeCommit?: ChangeCommitCallback;
}

export interface PickForceDefaultExports {
  // throw if a migration doesn't have a default export
  forceDefaultExports?: boolean;
}

interface RakeDbBaseConfig<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> extends QueryLogOptions,
    PickImport,
    PickMigrationId,
    PickMigrationsPath,
    PickMigrations,
    PickRenameMigrations,
    PickMigrationsTable,
    PickMigrationCallbacks,
    PickForceDefaultExports,
    PickAfterChangeCommit {
  schemaConfig: SchemaConfig;
  snakeCase: boolean;
  language?: string;
  commands: Record<string, CommandFn<SchemaConfig, CT>>;
  noPrimaryKey?: NoPrimaryKeyOption;
  baseTable?: RakeDbBaseTable<CT>;
}

export interface RakeDbConfig<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> extends RakeDbBaseConfig<SchemaConfig, CT>,
    PickBasePath,
    PickTransactionSetting {
  columnTypes: CT;
  dbScript: string;
  recurrentPath: string;
}

export interface InputRakeDbConfigBase<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
> extends QueryLogOptions,
    PickOptionalMigrationsPath {
  columnTypes?: CT | ((t: DefaultColumnTypes<DefaultSchemaConfig>) => CT);
  baseTable?: RakeDbBaseTable<CT>;
  schemaConfig?: SchemaConfig;
  basePath?: string;
  dbScript?: string;
  migrationId?: 'serial' | RakeDbMigrationId;
  recurrentPath?: string;
  migrationsTable?: string;
  snakeCase?: boolean;
  language?: string;
  commands?: Record<
    string,
    (
      adapter: AdapterBase[],
      config: RakeDbConfig<SchemaConfig, CT>,
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

interface InputRakeDbConfigFileBased<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
> extends InputRakeDbConfigBase<SchemaConfig, CT> {
  /**
   * It may look odd, but it's required for `tsx` and other bundlers to have such `import` config specified explicitly.
   */
  import(path: string): Promise<unknown>;
}

interface InputRakeDbConfigCodeBased<
  SchemaConfig extends ColumnSchemaConfig,
  CT,
> extends InputRakeDbConfigBase<SchemaConfig, CT> {
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

export type InputRakeDbConfig<SchemaConfig extends ColumnSchemaConfig, CT> =
  | InputRakeDbConfigFileBased<SchemaConfig, CT>
  | InputRakeDbConfigCodeBased<SchemaConfig, CT>;

interface ChangeCallback {
  (arg: {
    db: DbResult<unknown>;
    up: boolean;
    redo: boolean;
    migrations: MigrationItem[];
  }): void | Promise<void>;
}

interface ChangeCommitCallback {
  (arg: {
    adapter: AdapterBase;
    up: boolean;
    migrations: MigrationItem[];
  }): void | Promise<void>;
}

interface MigrationCallback {
  (arg: {
    db: DbResult<unknown>;
    migrations: MigrationItem[];
  }): void | Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRakeDbConfig = RakeDbConfig<any, any>;

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

export const migrationConfigDefaults: RakeDbBaseConfig<ColumnSchemaConfig> = {
  schemaConfig: defaultSchemaConfig,
  migrationsPath: path.join('src', 'db', 'migrations'),
  migrationId: { serial: 4 },
  migrationsTable: 'schemaMigrations',
  snakeCase: false,
  commands: {},
  log: true,
  logger: console,
  import() {
    throw new Error(
      'Add `import: (path) => import(path),` setting to `rakeDb` config',
    );
  },
};

export const ensureMigrationsPath = <
  T extends {
    migrationsPath?: string;
    basePath: string;
  },
>(
  config: T,
): T & { migrationsPath: string } => {
  if (!config.migrationsPath) {
    config.migrationsPath = migrationConfigDefaults.migrationsPath;
  }

  if (!path.isAbsolute(config.migrationsPath)) {
    config.migrationsPath = path.resolve(
      config.basePath,
      config.migrationsPath,
    );
  }

  return config as never;
};

export const ensureBasePathAndDbScript = <
  T extends {
    basePath?: string;
    dbScript?: string;
  },
>(
  config: T,
  intermediateCallers = 0,
): T & { basePath: string; dbScript: string } => {
  if (config.basePath && config.dbScript) return config as never;

  // 0 is getStackTrace file, 1 is this function, 2 is a caller in rakeDb.ts, 3 is the user db script file.
  // when called from processRakeDbConfig, 1 call is added.
  // bundlers can bundle all files into a single file, or change file structure, so this must rely only on the caller index.
  let filePath = getStackTrace()?.[3 + intermediateCallers]?.getFileName();
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

  config.basePath = path.dirname(filePath);
  config.dbScript = path.basename(filePath);
  return config as never;
};

export const processRakeDbConfig = <
  SchemaConfig extends ColumnSchemaConfig,
  CT,
>(
  config: InputRakeDbConfig<SchemaConfig, CT>,
  args?: string[],
): RakeDbConfig<SchemaConfig, CT> => {
  const result = { ...migrationConfigDefaults, ...config } as RakeDbConfig<
    SchemaConfig,
    CT
  >;

  if (!result.log) {
    delete result.logger;
  }

  ensureBasePathAndDbScript(result, 1);
  ensureMigrationsPath(result);

  if (!result.recurrentPath) {
    result.recurrentPath = path.join(
      result.migrationsPath as string,
      'recurrent',
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

  const transaction = getCliParam(args, 'transaction');
  if (transaction) {
    if (transaction !== 'single' && transaction !== 'per-migration') {
      throw new Error(
        `Unsupported transaction param ${transaction}, expected single or per-migration`,
      );
    }
    result.transaction = transaction;
  } else if (!result.transaction) {
    result.transaction = 'single';
  }

  return result as RakeDbConfig<SchemaConfig, CT>;
};
