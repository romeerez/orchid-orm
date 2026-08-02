import { Migration } from './migration';
import { DbStructure } from 'rake-db';
export declare const createOrDropRole: (migration: Migration, up: boolean, name: string, params?: Partial<DbStructure.Role>) => Promise<void>;
export declare const changeRole: (migration: Migration, up: boolean, name: string, from: Partial<DbStructure.Role>, to: Partial<DbStructure.Role>) => Promise<void>;
export declare const renameRole: (migration: Migration, up: boolean, from: string, to: string) => Promise<void>;
