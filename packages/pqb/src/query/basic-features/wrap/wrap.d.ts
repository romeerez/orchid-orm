import { IsQuery, Query } from '../../query';
import { FromQuerySelf } from '../from/from';
import { SetQueryTableAlias } from '../as/as';
export type WrapQueryArg = FromQuerySelf;
export declare function queryWrap<T extends IsQuery, Q extends WrapQueryArg, As extends string = 't'>(self: T, query: Q, as?: As): SetQueryTableAlias<Q, As>;
/**
 * This function is useful when wrapping a query,
 * such as when doing `SELECT json_agg(t.*) FROM (...) AS t`,
 * to get rid of default scope conditions (WHERE deletedAt IS NULL)
 * that otherwise would be duplicated inside the `FROM` and after `AS t`.
 */
export declare function cloneQueryBaseUnscoped(query: Query): Query;
export declare class QueryWrap {
    wrap<T extends IsQuery, Q extends WrapQueryArg, As extends string = 't'>(this: T, query: Q, as?: As): SetQueryTableAlias<Q, As>;
}
