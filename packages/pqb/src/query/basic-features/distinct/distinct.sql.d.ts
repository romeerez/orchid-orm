import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
export declare const pushDistinctSql: (ctx: ToSQLCtx, table: ToSQLQuery, distinct: Exclude<QueryData['distinct'], undefined>, quotedAs?: string) => void;
