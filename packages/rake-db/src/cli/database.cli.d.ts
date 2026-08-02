import { Adapter } from 'pqb/internal';
import { RakeDbConfig } from '../config/config';
export declare const createDatabaseCommand: (adapters: Adapter[], config: RakeDbConfig, dontClose?: boolean) => Promise<void>;
export declare const dropDatabaseCommand: (adapters: Adapter[], config: RakeDbConfig) => Promise<void>;
export declare const createOrDropDatabase: (action: 'create' | 'drop', adapters: Adapter[], config: RakeDbConfig, dontClose?: boolean) => Promise<void>;
export declare const resetDatabaseCommand: (adapters: Adapter[], config: RakeDbConfig) => Promise<void>;
export declare const askForAdminCredentials: (create?: boolean) => Promise<{
    user: string;
    password?: string;
} | undefined>;
