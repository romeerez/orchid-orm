import { RakeDbCtx } from '../common';
import { RakeDbConfig } from '../config/config';
export declare const writeMigrationFile: (config: RakeDbConfig, version: string, name: string, migrationCode: string) => Promise<void>;
export declare const newMigration: (config: RakeDbConfig, name: string) => Promise<void>;
export declare const makeFileVersion: (ctx: RakeDbCtx, config: RakeDbConfig) => Promise<string>;
export declare const generateTimeStamp: () => string;
