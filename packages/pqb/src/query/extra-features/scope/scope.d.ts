import { QueryHasWhere, Where } from '../../basic-features/where/where';
import { Query, SelectableFromShape } from '../../query';
import { Column } from '../../../columns/column';
import { PickQueryScopes, PickQuerySelectableShapeRelationsWithData } from '../../pick-query-types';
export type QueryScopes<Keys extends string> = {
    [K in Keys]: unknown;
};
export interface ScopeArgumentQuery<Table extends string | undefined, Shape extends Column.QueryColumns> extends Where, PickQuerySelectableShapeRelationsWithData {
    __isQuery: true;
    table: Table;
    shape: Shape;
    __selectable: SelectableFromShape<Shape, Table>;
}
export declare const _unscope: (q: Query, scope: PropertyKey) => Query;
/**
 * This feature allows defining a set of query modifiers to use it later.
 * Only [where conditions](/guide/where.html) can be set in a scope.
 * If you define a scope with name `default`, it will be applied for all table queries by default.
 *
 * ```ts
 * import { defineTable } from './table-factory';
 *
 * export const SomeTable = defineTable('some', (t) => ({
 *   id: t.identity().primaryKey(),
 *   hidden: t.boolean(),
 *   active: t.boolean(),
 * })).scopes({
 *   default: (q) => q.where({ hidden: false }),
 *   active: (q) => q.where({ active: true }),
 * });
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
export declare class QueryScope {
    /**
     * See {@link QueryScope}
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
    scope<T extends PickQueryScopes>(this: T, scope: keyof T['__scopes']): T & QueryHasWhere;
    /**
     * See {@link QueryScope}
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
    unscope<T extends PickQueryScopes>(this: T, scope: keyof T['__scopes']): T;
}
