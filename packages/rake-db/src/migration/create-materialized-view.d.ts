import { Migration } from './migration';
import { RawSqlBase } from 'pqb/internal';
import { RakeDbAst } from '../ast';
export declare const createMaterializedView: (migration: Migration, up: boolean, name: string, options: RakeDbAst.MaterializedViewOptions, sql: string | RawSqlBase) => Promise<void>;
export declare const refreshMaterializedView: (migration: Migration, name: string, options?: RakeDbAst.RefreshMaterializedViewOptions) => Promise<void>;
