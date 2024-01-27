import { Query, SetQueryKind, SetQueryReturnsRowCount } from '../query/query';
import { throwIfNoWhere } from '../query/queryUtils';

export type DeleteMethodsNames = 'delete';

export type DeleteArgs<T extends Query> = T['meta']['hasWhere'] extends true
  ? []
  : [never];

export type DeleteResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? SetQueryKind<T, 'delete'>
  : SetQueryReturnsRowCount<SetQueryKind<T, 'delete'>>;

export const _queryDelete = <T extends Query>(q: T): DeleteResult<T> => {
  if (!q.q.select) {
    if (q.q.returnType === 'oneOrThrow' || q.q.returnType === 'valueOrThrow') {
      q.q.throwOnNotFound = true;
    }
    q.q.returnType = 'rowCount';
  }

  throwIfNoWhere(q, 'delete');

  q.q.type = 'delete';
  return q as unknown as DeleteResult<T>;
};

export class Delete {
  /**
   * It is aliased to `del` because `delete` is a reserved word in JavaScript.
   *
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
   * db.table.join(Profile, 'profile.userId', 'user.id').all().delete();
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return _queryDelete(this.clone());
  }
}
