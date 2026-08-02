import { RakeDbConfig } from '../config/config';
import { Adapter } from 'pqb/internal';
export declare const fileNamesToChangeMigrationId: {
    serial: string;
    timestamp: string;
};
export declare const fileNamesToChangeMigrationIdMap: {
    [k: string]: boolean;
};
export declare const changeIds: (adapters: Adapter[], config: RakeDbConfig, { format, digits }: {
    format: 'serial' | 'timestamp';
    digits?: number;
}) => Promise<void>;
export type RenameMigrationVersionsValue = [
    oldVersion: string,
    name: string,
    newVersion: string | number
];
export declare const renameMigrationVersionsInDb: (config: Pick<RakeDbConfig, 'migrationsTable'>, adapter: Adapter, values: RenameMigrationVersionsValue[]) => Promise<void>;
