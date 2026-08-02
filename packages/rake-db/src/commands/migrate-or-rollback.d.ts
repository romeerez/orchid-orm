import { Adapter, MaybePromise, NoPrimaryKeyOption, QueryLogOptions } from 'pqb/internal';
import { RakeDbCtx } from '../common';
import { MigrationChange } from '../migration/change';
import { SilentQueries } from '../migration/migration';
import { RakeDbAppliedVersions } from '../migration/manage-migrated-versions';
import type { ChangeCallback, ChangeCommitCallback, MigrationCallback, ModuleExportsRecord, RakeDbBaseTable, RakeDbDefineTable, RakeDbMigrationId, RakeDbRenameMigrationsInput, SearchPath } from '../config/config';
import { MigrationItem, MigrationItemHasLoad, MigrationsSet } from '../migration/migrations-set';
import { DbParam } from '../utils';
export interface MigrateFnParams {
    ctx?: RakeDbCtx;
    count?: number;
    force?: boolean;
}
export interface MigrateConfigBase extends QueryLogOptions {
    migrationId?: RakeDbMigrationId;
    renameMigrations?: RakeDbRenameMigrationsInput;
    migrationsTable?: string;
    transaction?: 'single' | 'per-migration';
    transactionSearchPath?: SearchPath;
    forceDefaultExports?: boolean;
    beforeChange?: ChangeCallback;
    afterChange?: ChangeCallback;
    afterChangeCommit?: ChangeCommitCallback;
    beforeMigrate?: MigrationCallback;
    afterMigrate?: MigrationCallback;
    beforeRollback?: MigrationCallback;
    afterRollback?: MigrationCallback;
    snakeCase?: boolean;
    language?: string;
    noPrimaryKey?: NoPrimaryKeyOption;
    defineTable?: RakeDbDefineTable<unknown>;
    baseTable?: RakeDbBaseTable<unknown>;
}
export interface MigrateConfigFileBased extends MigrateConfigBase {
    basePath?: string;
    migrationsPath: string;
    import(path: string): Promise<unknown>;
}
export interface MigrateConfigMigrationsProvided extends MigrateConfigBase {
    migrations: ModuleExportsRecord;
}
/**
 * Minimal configuration required by public migration functions
 * (`migrate`, `rollback`, `redo`) and the functions they invoke.
 *
 * Pass `log: true` to enable logging to console,
 * `log: false` to disable it, or leave `log` undefined to preserve the existing `logger`.
 *
 * All properties of {@link RakeDbConfig} that are unrelated to running migrations
 * (e.g. `commands`, `recurrentPath`, `schemaConfig`) are intentionally excluded.
 */
export type MigrateConfig = MigrateConfigFileBased | MigrateConfigMigrationsProvided;
export interface MigrateFn {
    (db: DbParam, config: MigrateConfig, params?: MigrateFnParams): Promise<void>;
}
export interface MigrateConfigInternal extends MigrateConfigFileBased {
    migrations?: ModuleExportsRecord;
    migrationId: RakeDbMigrationId;
    migrationsTable: string;
    transaction: 'single' | 'per-migration';
}
export declare const migrateConfigDefaults: {
    migrationId: {
        serial: number;
    };
    migrationsTable: string;
    transaction: string;
};
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
 * @param db - optionally provided by `migrate` to get the logger from it
 * @returns a processed RakeDbConfig ready for internal use
 */
export declare const processMigrateConfig: (config: MigrateConfig, db?: DbParam) => MigrateConfigInternal;
/**
 * Will run all pending yet migrations, sequentially in order,
 * will apply `change` functions top-to-bottom.
 *
 * Supports `log?: boolean` option in config for programmatic use:
 * - `log: true` - enables logging to console
 * - `log: false` - disables logging
 * - `log: undefined` - preserves existing logger (for custom loggers)
 *
 * @param db - database adapter or transaction
 * @param config - specifies how to load migrations, callbacks, and logger
 * @param params - optional migration parameters (ctx, count, force)
 */
export declare const migrate: MigrateFn;
export declare const migrateAndClose: MigrateFn;
interface RunMigrationConfig extends QueryLogOptions {
    transactionSearchPath?: SearchPath;
}
export declare function runMigration(db: DbParam, migration: () => MaybePromise<unknown>): Promise<void>;
export declare function runMigration(db: DbParam, config: RunMigrationConfig, migration: () => MaybePromise<unknown>): Promise<void>;
/**
 * Will roll back one latest applied migration,
 * will apply `change` functions bottom-to-top.
 *
 * Supports `log?: boolean` option in config for programmatic use:
 * - `log: true` - enables logging to console
 * - `log: false` - disables logging
 * - `log: undefined` - preserves existing logger (for custom loggers)
 *
 * Takes the same options as {@link migrate}.
 *
 * @param db - database adapter or transaction
 * @param config - specifies how to load migrations, callbacks, and logger
 * @param params - optional rollback parameters (ctx, count, force)
 */
export declare const rollback: MigrateFn;
/**
 * Calls {@link rollback} and then {@link migrate}.
 *
 * Supports `log?: boolean` option in config for programmatic use:
 * - `log: true` - enables logging to console
 * - `log: false` - disables logging
 * - `log: undefined` - preserves existing logger (for custom loggers)
 *
 * Takes the same options as {@link migrate}.
 *
 * @param db - database adapter or transaction
 * @param config - specifies how to load migrations, callbacks, and logger
 * @param params - optional redo parameters (ctx, count, force)
 */
export declare const redo: MigrateFn;
export declare const migrateOrRollback: (trx: Adapter, config: MigrateConfigInternal, set: MigrationsSet, versions: RakeDbAppliedVersions, count: number, up: boolean, redo: boolean, force?: boolean, skipLock?: boolean) => Promise<MigrationItem[]>;
export declare const changeCache: Record<string, MigrationChange[] | undefined>;
export declare const getChanges: (file: MigrationItemHasLoad, config?: Pick<MigrateConfigInternal, 'forceDefaultExports'>) => Promise<MigrationChange[]>;
export declare const runMigrationInOwnTransaction: typeof applyMigration;
/**
 * Process one migration file.
 * It performs a db transaction, loads `change` functions from a file, executes them in order specified by `up` parameter.
 * After calling `change` functions successfully, will save new entry or delete one in case of `up: false` from the migrations table.
 */
export declare const applyMigration: (trx: Adapter, up: boolean, changes: MigrationChange[], config: Pick<MigrateConfigInternal, 'log' | 'logger' | 'transactionSearchPath'>) => Promise<SilentQueries>;
export {};
