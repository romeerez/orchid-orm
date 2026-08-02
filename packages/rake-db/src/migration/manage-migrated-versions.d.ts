import { RakeDbCtx } from '../common';
import { SilentQueries } from './migration';
import { Adapter, QueryLogger, RecordOptionalString, TransactionAdapter } from 'pqb/internal';
import { RakeDbConfig, RakeDbRenameMigrations } from '../config/config';
import { DbParam } from '../utils';
import { MigrateConfigInternal } from '../commands/migrate-or-rollback';
export declare const saveMigratedVersion: (db: SilentQueries, version: string, name: string, config: Pick<RakeDbConfig, 'migrationsTable'>) => Promise<void>;
export declare const createMigrationsSchemaAndTable: (db: DbParam, config: {
    migrationsTable: string;
    logger?: QueryLogger;
}) => Promise<void>;
export declare const deleteMigratedVersion: (adapter: SilentQueries, version: string, name: string, config: Pick<RakeDbConfig, 'migrationsTable'>) => Promise<void>;
export type RakeDbAppliedVersions = {
    map: RecordOptionalString;
    sequence: number[];
};
export declare class NoMigrationsTableError extends Error {
}
export declare const getMigratedVersionsMap: (_ctx: RakeDbCtx, adapter: Adapter | TransactionAdapter, config: Pick<MigrateConfigInternal, 'migrations' | 'basePath' | 'migrationId' | 'migrationsPath' | 'import' | 'migrationsTable'>, renameTo?: RakeDbRenameMigrations) => Promise<RakeDbAppliedVersions>;
