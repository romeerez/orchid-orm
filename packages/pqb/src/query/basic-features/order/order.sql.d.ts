import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { Expression } from '../../expressions/expression';
export type SortDir = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST';
export type OrderItem = string | {
    [K: string]: SortDir;
} | Expression;
export declare const pushOrderBySql: (ctx: ToSQLCtx, data: QueryData, quotedAs: string | undefined, order: Exclude<QueryData['order'], undefined>) => void;
export declare const orderByToSql: (ctx: ToSQLCtx, data: QueryData, order: OrderItem, quotedAs?: string) => string;
