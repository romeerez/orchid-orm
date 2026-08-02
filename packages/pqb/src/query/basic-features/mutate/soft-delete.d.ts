import { IsQuery, Query } from '../../query';
import { Column } from '../../../columns/column';
import { PickQueryHasSelect, PickQueryHasWhere, PickQueryResult, PickQueryReturnType } from '../../pick-query-types';
import { DeleteArgs, DeleteResult } from './delete';
import { QueryDataScopes } from '../../query-data';
export type SoftDeleteOption<Shape extends Column.QueryColumns> = true | keyof Shape;
export declare function enableSoftDelete(query: IsQuery, table: string | undefined, shape: Column.QueryColumnsInit, softDelete: true | PropertyKey, scopes: QueryDataScopes): void;
export interface QueryWithSoftDelete extends PickQueryResult, PickQueryReturnType, PickQueryHasSelect, PickQueryHasWhere, Query.Pick.IsNotReadOnly {
    __scopes: NonDeletedScope;
}
export interface NonDeletedScope {
    nonDeleted: true;
}
/**
 * `softDelete` configures the table to set `deletedAt` to current time instead of deleting records.
 * All queries on such table will filter out deleted records by default.
 *
 * ```ts
 * import { defineTable } from './table-factory';
 *
 * export const SomeTable = defineTable('some', (t) => ({
 *   id: t.identity().primaryKey(),
 *   deletedAt: t.timestamp().nullable(),
 * }))
 *   // true is for using `deletedAt` column
 *   .softDelete();
 *
 * // or provide a different column name
 * export const OtherTable = defineTable('other', (t) => ({
 *   id: t.identity().primaryKey(),
 *   myDeletedAt: t.timestamp().nullable(),
 * })).softDelete('myDeletedAt');
 *
 * const db = orchidORM(
 *   { databaseURL: '...' },
 *   {
 *     someTable: SomeTable,
 *   },
 * );
 *
 * // deleted records are ignored by default
 * const onlyNonDeleted = await db.someTable;
 * ```
 */
export declare class SoftDeleteMethods {
    /**
     * `includeDeleted` disables the default `deletedAt` filter:
     *
     * ```ts
     * const allRecords = await db.someTable.includeDeleted();
     * ```
     */
    includeDeleted<T extends QueryWithSoftDelete>(this: T): T;
    /**
     * `hardDelete` deletes records bypassing the `softDelete` behavior:
     *
     * ```ts
     * await db.someTable.find(1).hardDelete();
     * ```
     */
    hardDelete<T extends QueryWithSoftDelete>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T>;
}
