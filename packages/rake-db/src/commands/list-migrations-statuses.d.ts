import { RakeDbConfig } from '../config/config';
import { Adapter } from 'pqb/internal';
export declare const listMigrationsStatuses: (adapters: Adapter[], config: RakeDbConfig, params?: {
    showUrl?: boolean;
}) => Promise<void>;
