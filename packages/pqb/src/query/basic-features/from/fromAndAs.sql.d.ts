import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
export declare const pushFromAndAs: (ctx: ToSQLCtx, query: ToSQLQuery, data: QueryData, quotedAs?: string) => SubQueryForSql | undefined;
