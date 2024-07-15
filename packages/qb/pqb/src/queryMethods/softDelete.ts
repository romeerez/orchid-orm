import {
  PickQueryResult,
  QueryColumns,
  QueryColumnsInit,
  QueryMetaBase,
  RecordUnknown,
} from 'orchid-core';
import { QueryScopes } from '../sql';
import { Query } from '../query/query';
import { RawSQL } from '../sql/rawSql';
import {
  _queryDelete,
  _queryUpdate,
  DeleteArgs,
  DeleteResult,
  UpdateArg,
} from './index';

export type SoftDeleteOption<Shape extends QueryColumns> = true | keyof Shape;

export function enableSoftDelete(
  q: Query,
  table: string | undefined,
  shape: QueryColumnsInit,
  softDelete: true | PropertyKey,
  scopes: QueryScopes,
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
  (q.q.scopes ??= {}).nonDeleted = scope;

  const _del = _softDelete(column, q.internal.nowSQL);
  // @ts-expect-error it's ok
  q.baseQuery.delete = function (this: Query) {
    return _del.call(this.clone());
  };
}

const nowSql = new RawSQL('now()');

const _softDelete = (column: PropertyKey, customNowSQL?: string) => {
  const set = { [column]: customNowSQL ? new RawSQL(customNowSQL) : nowSql };
  return function <T extends Query>(this: T) {
    return _queryUpdate(this, set as UpdateArg<T>);
  };
};

export interface QueryWithSoftDelete extends PickQueryResult {
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
    return _queryDelete(
      (this as unknown as Query).clone().unscope('nonDeleted' as never),
    ) as never;
  }
}
