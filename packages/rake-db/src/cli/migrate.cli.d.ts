import { Adapter } from 'pqb/internal';
import { RakeDbConfig } from '../config/config';
export declare const migrateCommand: (adapters: Adapter[], config: RakeDbConfig, args: string[]) => Promise<void>;
export declare const rollbackCommand: (adapters: Adapter[], config: RakeDbConfig, args: string[]) => Promise<void>;
export declare const redoCommand: (adapters: Adapter[], config: RakeDbConfig, args: string[]) => Promise<void>;
