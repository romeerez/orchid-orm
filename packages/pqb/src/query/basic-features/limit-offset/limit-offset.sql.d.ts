import { QueryData } from '../../query-data';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { ToSQLCtx } from '../../sql/to-sql';
export declare function pushLimitOffsetSql(ctx: ToSQLCtx, query: QueryData, fromQuery?: SubQueryForSql): void;
export declare function pushLimitSQL(sql: string[], values: unknown[], q: QueryData): void;
