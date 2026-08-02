import { Adapter, QueryLogger } from 'pqb/internal';
export declare const runRecurrentMigrations: (adapters: Adapter[], config: {
    recurrentPath: string;
    logger?: QueryLogger;
}) => Promise<void>;
