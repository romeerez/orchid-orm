import {
  QueryLogOptions,
  AdapterBase,
  ColumnSchemaConfig,
  DbResult,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  MaybePromise,
  NoPrimaryKeyOption,
  RecordString,
} from 'pqb/internal';
import path from 'path';
import { MigrationItem } from './migration/migrations-set';

export type SearchPath = (() => string) | string;

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
  transactionSearchPath?: SearchPath;
  /**
   * Throw if a migration doesn't have a default export.
   * This is needed when in your setup you're importing migration files first and execute them later,
   * in that case you should export changes in migrations.
   */
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
  recurrentPath?: string;
  columnTypes: ColumnTypes;
  beforeChange?: ChangeCallback;
  afterChange?: ChangeCallback;
  beforeMigrate?: MigrationCallback;
  afterMigrate?: MigrationCallback;
  beforeRollback?: MigrationCallback;
  afterRollback?: MigrationCallback;
  migrationId: RakeDbMigrationId;
  transactionSearchPath?: SearchPath;
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

/**
 * Configuration type for public migration functions (`migrate`, `rollback`, `redo`).
 * Extends `RakeDbConfig` with `QueryLogOptions` to allow passing `log?: boolean`
 * for programmatic migration control.
 *
 * When `log: true` is passed, `logger` will be set to `console`.
 * When `log: false` is passed, `logger` will be removed.
 * When `log` is undefined, the existing `logger` is preserved (useful for custom loggers).
 *
 * @example
 * ```ts
 * await migrate(db, { ...config, log: true });
 * ```
 */
export type PublicRakeDbConfig<ColumnTypes = unknown> =
  RakeDbConfig<ColumnTypes>;

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

/**
 * Process a PublicRakeDbConfig into RakeDbConfig by handling the `log` option.
 * This is used by public migration functions (migrate, rollback, redo) to
 * process the `log` boolean into the appropriate `logger` setting.
 *
 * - `log: true` → sets `logger` to `console`
 * - `log: false` → removes `logger` (non-mutatively)
 * - `log: undefined` → preserves existing `logger`
 *
 * @param config - the public config with optional `log` setting
 * @returns a processed RakeDbConfig ready for internal use
 */
export const processPublicRakeDbConfig = <ColumnTypes>(
  config: PublicRakeDbConfig<ColumnTypes>,
): RakeDbConfig<ColumnTypes> => {
  if (config.log === false) {
    // Non-mutatively remove logger when log is explicitly false
    const { logger: _, ...rest } = config;
    return rest as RakeDbConfig<ColumnTypes>;
  } else if (config.log === true) {
    // Non-mutatively set logger to console when log is true
    return { ...config, logger: console } as RakeDbConfig<ColumnTypes>;
  }
  // If log is undefined, preserve existing logger (whether custom or undefined)
  // Return a copy to avoid mutations
  return { ...config } as RakeDbConfig<ColumnTypes>;
};
