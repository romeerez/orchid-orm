import { QueryBase } from '../query/queryBase';
import { QueryColumns, QueryMetaBase } from 'orchid-core';
import { QueryScopes, SelectQueryData, WhereItem } from '../sql';
import { pushQueryArray, setQueryObjectValue } from '../query/queryUtils';
import { Where, WhereResult } from './where/where';
import { SelectableFromShape } from '../query/query';

interface ScopeArgumentQueryMeta<
  Table extends string | undefined,
  Shape extends QueryColumns,
> extends QueryMetaBase {
  selectable: SelectableFromShape<Shape, Table>;
}

export interface ScopeArgumentQuery<
  Table extends string | undefined,
  Shape extends QueryColumns,
> extends Where,
    QueryBase {
  table: Table;
  shape: Shape;
  meta: ScopeArgumentQueryMeta<Table, Shape>;
}

/**
 * This feature allows defining a set of query modifiers to use it later.
 * Only [where conditions](/guide/where.html) can be set in a scope.
 * If you define a scope with name `default`, it will be applied for all table queries by default.
 *
 * ```ts
 * import { BaseTable } from './baseTable';
 *
 * export class SomeTable extends BaseTable {
 *   readonly table = 'some';
 *   columns = this.setColumns((t) => ({
 *     id: t.identity().primaryKey(),
 *     hidden: t.boolean(),
 *     active: t.boolean(),
 *   }));
 *
 *   scopes = this.setScopes({
 *     default: (q) => q.where({ hidden: false }),
 *     active: (q) => q.where({ active: true }),
 *   });
 * }
 *
 * const db = orchidORM(
 *   { databaseURL: '...' },
 *   {
 *     some: SomeTable,
 *   },
 * );
 *
 * // the default scope is applied for all queries:
 * const nonHiddenRecords = await db.some;
 * ```
 */
export class ScopeMethods {
  /**
   * See {@link ScopeMethods}
   *
   * Use the `scope` method to apply a pre-defined scope.
   *
   * ```ts
   * // use the `active` scope that is defined in the table:
   * await db.some.scope('active');
   * ```
   *
   * @param scope - name of the scope to apply
   */
  scope<T extends QueryBase>(
    this: T,
    scope: keyof T['meta']['scopes'],
  ): WhereResult<T> {
    const q = this.clone();

    if (!q.q.scopes?.[scope as string]) {
      const s = (this.internal.scopes as QueryScopes)[scope as string];

      if (s.and) pushQueryArray(q, 'and', s.and);
      if (s.or) pushQueryArray(q, 'or', s.or);

      setQueryObjectValue(q, 'scopes', scope as string, s);
    }

    return q as WhereResult<T>;
  }

  /**
   * See {@link ScopeMethods}
   *
   * Remove conditions that were added by the scope from the query.
   *
   * ```ts
   * // SomeTable has a default scope, ignore it for this query:
   * await db.some.unscope('default');
   * ```
   *
   * @param scope - name of the scope to remove from the query
   */
  unscope<T extends QueryBase>(this: T, scope: keyof T['meta']['scopes']): T {
    const q = this.clone();
    const data = q.q as SelectQueryData;

    const s = q.q.scopes?.[scope as string];
    if (s) {
      const { and, or } = s;
      if (and) {
        data.and = (data.and as WhereItem[]).filter((x) => !and.includes(x));
        if (!data.and.length) delete data.and;
      }

      if (or) {
        data.or = (data.or as WhereItem[][]).filter((x) => !or.includes(x));
        if (!data.or.length) delete data.or;
      }

      delete (q.q.scopes as QueryScopes)[scope as string];
    }

    return q as WhereResult<T>;
  }
}
