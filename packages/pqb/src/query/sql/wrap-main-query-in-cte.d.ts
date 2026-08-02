import { QueryData, QueryType } from '../query-data';
import { ToSQLCtx } from './to-sql';
export declare const getShouldWrapMainQueryInCte: (ctx: ToSQLCtx, q: QueryData, type: QueryType, isSubSql?: boolean) => boolean | undefined;
export declare const wrapMainQueryInCte: (ctx: ToSQLCtx, q: QueryData, isSubSql?: boolean) => void;
