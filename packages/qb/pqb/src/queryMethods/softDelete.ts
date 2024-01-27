import { QueryColumns, QueryColumnsInit } from 'orchid-core';
import { pushQueryValue } from '../query/queryUtils';
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

  (scopes as Record<string, unknown>).deleted = scope;
  pushQueryValue(q, 'and', scope.and[0]);
  (q.q.scopes ??= {}).nonDeleted = scope;

  const _del = _softDelete(column);
  // @ts-expect-error it's ok
  q.baseQuery.delete = function (this: Query) {
    return _del.call(this.clone());
  };
}

const nowSql = new RawSQL('now()');

const _softDelete = (column: PropertyKey) => {
  const set = { [column]: nowSql };
  return function <T extends Query>(this: T) {
    return _queryUpdate(this, set as UpdateArg<T>);
  };
};

export type QueryWithSoftDelete = Query & {
  meta: { scopes: { nonDeleted: unknown } };
};

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
    return this.unscope('nonDeleted');
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
    return _queryDelete(this.clone().unscope('nonDeleted' as never));
  }
}
