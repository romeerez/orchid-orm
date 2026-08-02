import { ToSql, ToSQLCtx } from '../../sql/to-sql';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { QueryType } from '../../query-data';
export declare const moveQueryToCte: (ctx: ToSQLCtx, query: SubQueryForSql, type: QueryType, dontAddTableHook?: boolean) => {
    as: string;
    makeSelectList(isSubSql?: boolean): string[];
};
export declare const moveMutativeQueryToCteBase: (toSql: ToSql, ctx: ToSQLCtx, query: SubQueryForSql, type?: QueryType) => {
    as: string;
    makeSql(isSubSql?: boolean): string;
};
