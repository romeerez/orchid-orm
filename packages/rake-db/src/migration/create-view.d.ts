import { Migration } from './migration';
import { RawSqlBase } from 'pqb/internal';
import { RakeDbAst } from '../ast';
export declare const createView: (migration: Migration, up: boolean, name: string, options: RakeDbAst.ViewOptions, sql: string | RawSqlBase) => Promise<void>;
