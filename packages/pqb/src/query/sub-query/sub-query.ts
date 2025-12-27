import type { Query } from '../query';
import { _clone } from '../basic-features/clone/clone';
import { _chain } from '../extra-features/chain/chain';
import { _setSubQueryAliases } from '../basic-features/as/as';
import { ToSQLQuery } from '../sql/to-sql';
import { getClonedQueryData } from '../query-data';

/**
 * In `select`, `update`, `create` it's possible to pass a callback with a sub-query.
 * This function resolves such a sub-query.
 *
 * @param q - main query object to pass to a callback as argument
 * @param cb - sub-query callback
 */
export const resolveSubQueryCallback = (
  q: ToSQLQuery,
  cb: (q: ToSQLQuery) => ToSQLQuery,
): ToSQLQuery => {
  let base;
  // `with` can pass a generic `qb` here, it has no table.
  // Do not memoize anything into `internal` of a common `qb`,
  // because it is common and will be re-used.
  if (q.table) {
    base = q.internal.callbackArg;
    if (!base) {
      base = Object.create(q.baseQuery) as Query;
      base.baseQuery = base;

      const { relations } = q;
      for (const key in relations) {
        Object.defineProperty(base, key, {
          get() {
            const rel = relations[key as string];
            const relQuery = _clone(rel.query);
            relQuery.q.withShapes = this.q.withShapes;
            return _chain(this, relQuery, rel);
          },
        });
      }

      q.internal.callbackArg = base;
    }
  } else {
    base = q;
  }

  const arg = Object.create(base);

  arg.q = getClonedQueryData(q.q);
  arg.q.subQuery = 1;
  // Deleting `with` because sub-query should duplicate WITH statements of the parent query in its SQL
  arg.q.with = arg.q.relChain = undefined;
  _setSubQueryAliases(arg);

  return cb(arg as Query);
};
