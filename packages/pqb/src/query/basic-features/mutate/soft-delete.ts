import { IsQuery, Query } from '../../query';
import { RawSql } from '../../expressions/raw-sql';
import { Column } from '../../../columns/column';
import { RecordUnknown, setObjectValueImmutable } from '../../../utils';
import { QueryMetaBase } from '../../query-meta';
import {
  PickQueryBaseQuery,
  PickQueryInternal,
  PickQueryMetaResultReturnType,
  PickQueryQ,
} from '../../pick-query-types';
import { _clone } from '../clone/clone';
import { _queryUpdate } from './update';
import { _queryDelete, DeleteArgs, DeleteResult } from './delete';
import { QueryDataScopes } from '../../query-data';

export type SoftDeleteOption<Shape extends Column.QueryColumns> =
  | true
  | keyof Shape;

export function enableSoftDelete(
  query: IsQuery,
  table: string | undefined,
  shape: Column.QueryColumnsInit,
  softDelete: true | PropertyKey,
  scopes: QueryDataScopes,
) {
  const column = softDelete === true ? 'deletedAt' : softDelete;

  if (!shape[column as string]) {
    throw new Error(
      `Table ${table} is missing ${
        column as string
      } column which is required for soft delete`,
    );
  }

  const scope = {
    and: [{ [column]: null }],
  };

  (scopes as RecordUnknown).deleted = scope;
  const { q } = query as unknown as PickQueryQ;
  setObjectValueImmutable(q, 'scopes', 'nonDeleted', scope);

  const _del = _softDelete(
    column,
    (query as unknown as PickQueryInternal).internal.nowSQL,
  );
  (query as unknown as PickQueryBaseQuery).baseQuery.delete = function (
    this: unknown,
  ) {
    return _del.call(_clone(this));
  };
}

const nowSql = new RawSql('now()');

const _softDelete = (column: PropertyKey, customNowSQL?: string) => {
  const set = { [column]: customNowSQL ? new RawSql(customNowSQL) : nowSql };
  return function (this: unknown) {
    return _queryUpdate(this as never, set as never);
  };
};

export interface QueryWithSoftDelete extends PickQueryMetaResultReturnType {
  meta: QueryMetaBase<{ nonDeleted: true }>;
}

/**
 * `softDelete` configures the table to set `deletedAt` to current time instead of deleting records.
 * All queries on such table will filter out deleted records by default.
 *
 * ```ts
 * import { BaseTable } from './baseTable';
 *
 * export class SomeTable extends BaseTable {
 *   readonly table = 'some';
 *   columns = this.setColumns((t) => ({
 *     id: t.identity().primaryKey(),
 *     deletedAt: t.timestamp().nullable(),
 *   }));
 *
 *   // true is for using `deletedAt` column
 *   readonly softDelete = true;
 *   // or provide a different column name
 *   readonly softDelete = 'myDeletedAt';
 * }
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
export class SoftDeleteMethods {
  /**
   * `includeDeleted` disables the default `deletedAt` filter:
   *
   * ```ts
   * const allRecords = await db.someTable.includeDeleted();
   * ```
   */
  includeDeleted<T extends QueryWithSoftDelete>(this: T): T {
    return (this as unknown as Query).unscope('nonDeleted' as never) as never;
  }

  /**
   * `hardDelete` deletes records bypassing the `softDelete` behavior:
   *
   * ```ts
   * await db.someTable.find(1).hardDelete();
   * ```
   */
  hardDelete<T extends QueryWithSoftDelete>(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ..._args: DeleteArgs<T>
  ): DeleteResult<T> {
    return _queryDelete(_clone(this).unscope('nonDeleted' as never)) as never;
  }
}
