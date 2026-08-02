import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { Sql } from '../../sql/sql';
export declare const pushDeleteSql: (ctx: ToSQLCtx, query: ToSQLQuery, q: QueryData, quotedAs: string, isSubSql?: boolean) => Sql;
