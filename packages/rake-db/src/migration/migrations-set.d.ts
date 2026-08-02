import { RakeDbConfig, RakeDbRenameMigrations } from '../config/config';
import { MaybePromise } from 'pqb/internal';
import { RakeDbCtx } from '../common';
import { MigrateConfigInternal } from '../commands/migrate-or-rollback';
export interface MigrationItemHasLoad {
    path?: string;
    /**
     * Function that loads the migration content,
     * can store lazy import of a migration file.
     * Promise can return `{ default: x }` where `x` is a return of `change` or an array of such returns.
     */
    load(): MaybePromise<unknown>;
}
export interface MigrationItem extends MigrationItemHasLoad {
    path: string;
    version: string;
}
export interface MigrationsSet {
    renameTo?: RakeDbRenameMigrations;
    migrations: MigrationItem[];
}
export declare const getMigrations: (ctx: RakeDbCtx, config: Pick<MigrateConfigInternal, 'migrations' | 'basePath' | 'migrationId' | 'migrationsPath' | 'import'>, up: boolean, allowDuplicates?: boolean, getVersion?: typeof getMigrationVersionOrThrow) => Promise<MigrationsSet>;
export declare const sortMigrationsAsc: (a: {
    version: string;
}, b: {
    version: string;
}) => number;
export declare function getMigrationsFromFiles(config: Pick<MigrateConfigInternal, 'migrationsPath' | 'import' | 'migrationId' | 'logger'>, allowDuplicates?: boolean, getVersion?: typeof getMigrationVersionOrThrow): Promise<MigrationsSet>;
export declare function getMigrationVersionOrThrow(config: Pick<RakeDbConfig, 'migrationId'>, filePath: string): string;
export declare function getMigrationVersion(config: Pick<RakeDbConfig, 'migrationId'>, name: string): string | undefined;
export declare function getDigitsPrefix(name: string): string;
