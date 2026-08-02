import { ToSQLQuery } from '../../sql/to-sql';
/**
 * In `select`, `update`, `create` it's possible to pass a callback with a sub-query.
 * This function resolves such a sub-query.
 *
 * @param q - main query object to pass to a callback as argument
 * @param cb - sub-query callback
 */
export declare const resolveSubQueryCallback: (q: ToSQLQuery, cb: (q: ToSQLQuery) => ToSQLQuery) => ToSQLQuery;
