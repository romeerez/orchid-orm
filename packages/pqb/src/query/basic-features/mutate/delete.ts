import {
  SetQueryKind,
  SetQueryReturnsRowCount,
  SetQueryReturnsRowCountMany,
} from '../../query';
import { throwIfJoinLateral, throwIfNoWhere } from '../../query.utils';
import {
  PickQueryMetaResult,
  PickQueryMetaResultReturnType,
  PickQueryQ,
} from '../../pick-query-types';
import { EmptyTuple } from '../../../utils';
import { _clone } from '../clone/clone';

export type DeleteMethodsNames = 'delete';

export type DeleteArgs<T extends PickQueryMetaResult> =
  T['meta']['hasWhere'] extends true ? EmptyTuple : [never];

export type DeleteResult<T extends PickQueryMetaResultReturnType> =
  T['meta']['hasSelect'] extends true
    ? SetQueryKind<T, 'delete'>
    : T['returnType'] extends undefined | 'all'
    ? SetQueryReturnsRowCountMany<T, 'delete'>
    : SetQueryReturnsRowCount<T, 'delete'>;

export const _queryDelete = <T extends PickQueryMetaResultReturnType>(
  query: T,
): DeleteResult<T> => {
  const q = (query as unknown as PickQueryQ).q;
  if (!q.select) {
    if (q.returnType === 'oneOrThrow' || q.returnType === 'valueOrThrow') {
      q.throwOnNotFound = true;
    }
    q.returningMany = !q.returnType || q.returnType === 'all';
    q.returnType = 'valueOrThrow';
    q.returning = true;
  }

  throwIfNoWhere(query as unknown as PickQueryQ, 'delete');
  throwIfJoinLateral(query as unknown as PickQueryQ, 'delete');

  q.type = 'delete';
  return query as never;
};

export class Delete {
  /**
   * This method deletes one or more rows, based on other conditions specified in the query.
   *
   * By default, `delete` will return a count of deleted records.
   *
   * Place `select`, `selectAll`, or `get` before `delete` to specify returning columns.
   *
   * Need to provide `where`, `findBy`, or `find` conditions before calling `delete`.
   * To prevent accidental deletion of all records, deleting without where will result in TypeScript and a runtime error.
   *
   * Use `all()` to delete ALL records without conditions:
   *
   * ```ts
   * await db.table.all().delete();
   * ```
   *
   * ```ts
   * // deletedCount is the number of deleted records
   * const deletedCount = await db.table.where(...conditions).delete();
   *
   * // returns a single value, throws if not found
   * const id: number | undefined = await db.table
   *   .findBy(...conditions)
   *   .get('id')
   *   .delete();
   *
   * // returns an array of records with specified columns
   * const deletedRecord = await db.table
   *   .select('id', 'name', 'age')
   *   .where(...conditions)
   *   .delete();
   *
   * // returns an array of fully deleted records
   * const deletedUsersFull = await db.table
   *   .selectAll()
   *   .where(...conditions)
   *   .delete();
   * ```
   *
   * `delete` supports joining, under the hood the join is transformed to `USING` and `WHERE` statements:
   *
   * ```ts
   * // delete all users who have corresponding profile records:
   * db.table.join(db.profile, 'profile.userId', 'user.id').all().delete();
   * ```
   *
   * `delete` can be used in {@link WithMethods.with} expressions:
   *
   * ```ts
   * db.$qb
   *   // delete a record in one table
   *   .with('a', db.table.find(1).select('id').delete())
   *   // delete a record in other table using the first table record id
   *   .with('b', (q) =>
   *     db.otherTable.select('id').whereIn('aId', q.from('a').pluck('id')).delete(),
   *   )
   *   .from('b');
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete<T extends PickQueryMetaResultReturnType>(
    this: T,
    ..._args: DeleteArgs<T>
  ): DeleteResult<T> {
    return _queryDelete(_clone(this)) as never;
  }
}
