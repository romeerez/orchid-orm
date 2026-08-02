import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { Expression, TemplateLiteralArgs } from '../../expressions/expression';
export type HavingItem = TemplateLiteralArgs | Expression[];
export declare const pushHavingSql: (ctx: ToSQLCtx, query: QueryData, quotedAs?: string) => void;
export declare const havingToSql: (ctx: ToSQLCtx, query: QueryData, quotedAs?: string) => string | undefined;
