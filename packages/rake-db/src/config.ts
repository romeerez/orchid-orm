import {
  AdapterBase,
  ColumnSchemaConfig,
  DbResult,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  getStackTrace,
  makeColumnTypes as defaultColumnTypes,
  MaybePromise,
  NoPrimaryKeyOption,
  QueryLogOptions,
  QuerySchema,
  RecordString,
} from 'pqb';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { MigrationItem } from './migration/migrations-set';
import { getCliParam } from './common';
import { rakeDbCommands } from './cli/rake-db.cli';

export interface RakeDbCliConfigInputBase<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> extends QueryLogOptions {
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
  commands?: {
    [commandName: string]: RakeDbCommandFn | RakeDbCommand;
  };
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
  /**
   * It may look odd, but it's required for `tsx` and other bundlers to have such `import` config specified explicitly.
   */
  import?(path: string): Promise<unknown>;
}

interface RakeDbCliConfigInputFileBased<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> extends RakeDbCliConfigInputBase<SchemaConfig, CT> {
  migrationsPath?: string;
  /**
   * required for `tsx` and other bundlers to have such `import` config specified explicitly.
   */
  import(path: string): Promise<unknown>;
}

interface RakeDbCliConfigInputCodeBased<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> extends RakeDbCliConfigInputBase<SchemaConfig, CT> {
  /**
   * To specify array of migrations explicitly, without loading them from files.
   */
  migrations: ModuleExportsRecord;
  renameMigrations?: RakeDbRenameMigrationsInput;
}

export type RakeDbCliConfigInput<
  SchemaConfig extends ColumnSchemaConfig,
  CT = DefaultColumnTypes<DefaultSchemaConfig>,
> =
  | RakeDbCliConfigInputFileBased<SchemaConfig, CT>
  | RakeDbCliConfigInputCodeBased<SchemaConfig, CT>;

export interface RakeDbConfig<ColumnTypes = unknown> extends QueryLogOptions {
  /**
   * Set by makeRakeDbConfig to distinguish between the user-provided initial config from the processed one.
   */
  __rakeDbConfig: true;
  migrationsTable: string;
  /**
   * by default, all the migrated tables and the special table for tracking migrations are created in `public`.
   * set this `schema` setting to use create everything in this schema instead.
   */
  schema?: QuerySchema;
  recurrentPath?: string;
  columnTypes: ColumnTypes;
  beforeChange?: ChangeCallback;
  afterChange?: ChangeCallback;
  beforeMigrate?: MigrationCallback;
  afterMigrate?: MigrationCallback;
  beforeRollback?: MigrationCallback;
  afterRollback?: MigrationCallback;
  migrationId: RakeDbMigrationId;
  // throw if a migration doesn't have a default export
  forceDefaultExports?: boolean;
  afterChangeCommit?: ChangeCommitCallback;
  basePath: string;
  import(path: string): Promise<unknown>;
  migrationsPath: string;
  transaction: 'single' | 'per-migration';
  snakeCase?: boolean;
  schemaConfig: ColumnSchemaConfig;
  migrations?: ModuleExportsRecord;
  dbScript: string;
  renameMigrations?: RakeDbRenameMigrationsInput;
  language?: string;
  noPrimaryKey?: NoPrimaryKeyOption;
  baseTable?: RakeDbBaseTable<unknown>;
  commands: RakeDbCommands;
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
    throw new Error(
      'Add `import: (path) => import(path),` setting to `rakeDb` config',
    );
  },
};

export interface RakeDbCommandFn {
  (
    adapters: AdapterBase[],
    config: RakeDbConfig,
    args: string[],
  ): MaybePromise<unknown>;
}

export interface RakeDbCommand {
  run: RakeDbCommandFn;
  help?: string;
  helpArguments?: RecordString;
  helpAfter?: string;
}

export interface RakeDbCommands {
  [K: string]: RakeDbCommand;
}

export interface ChangeCallback {
  (arg: {
    db: DbResult<unknown>;
    up: boolean;
    redo: boolean;
    migrations: MigrationItem[];
  }): void | Promise<void>;
}

export interface ChangeCommitCallback {
  (arg: {
    adapter: AdapterBase;
    up: boolean;
    migrations: MigrationItem[];
  }): void | Promise<void>;
}

export interface MigrationCallback {
  (arg: {
    db: DbResult<unknown>;
    migrations: MigrationItem[];
  }): void | Promise<void>;
}

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
  [fileName: string]: () => Promise<unknown>;
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

let intermediateCallers = 0;
export const incrementIntermediateCaller = () => {
  intermediateCallers++;
};

export const makeRakeDbConfig = <ColumnTypes>(
  config: RakeDbCliConfigInput<ColumnSchemaConfig, ColumnTypes>,
  args?: string[],
): RakeDbConfig<ColumnTypes> => {
  const ic = intermediateCallers;
  intermediateCallers = 0;

  const result = {
    ...migrationConfigDefaults,
    ...config,
    __rakeDbConfig: true,
  } as unknown as RakeDbConfig<ColumnTypes>;

  if (!result.log) {
    delete result.logger;
  }

  ensureBasePathAndDbScript(result, ic);
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
      ? (ct as (t: DefaultColumnTypes<ColumnSchemaConfig>) => unknown)(
          defaultColumnTypes(defaultSchemaConfig),
        )
      : ct) || defaultColumnTypes(defaultSchemaConfig)) as ColumnTypes;
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

  let c = rakeDbCommands;
  if (config.commands) {
    c = { ...c };
    const commands = config.commands;
    for (const key in commands) {
      const command = commands[key];
      c[key] = typeof command === 'function' ? { run: command } : command;
    }
  }
  result.commands = c;

  return result;
};
