import { Query, SetQueryReturnsRowCount } from '../query';

export type DeleteMethodsNames = 'del' | '_del' | 'delete' | '_delete';

type DeleteArgs<T extends Query> = T['meta']['hasWhere'] extends true
  ? []
  : [never];

type DeleteResult<T extends Query> = T['meta']['hasSelect'] extends true
  ? T
  : SetQueryReturnsRowCount<T>;

const del = <T extends Query>(self: T): DeleteResult<T> => {
  return _del(self.clone()) as unknown as DeleteResult<T>;
};

const _del = <T extends Query>(q: T): DeleteResult<T> => {
  if (!q.query.select) {
    q.query.returnType = 'rowCount';
  }

  q.query.type = 'delete';
  return q as unknown as DeleteResult<T>;
};

export class Delete {
  /**
   * Alias for `delete` method
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  del<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return del(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _del<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return _del(this);
  }

  /**
   * It is aliased to `del` because `delete` is a reserved word in JavaScript.
   *
   * This method deletes one or more rows, based on other conditions specified in the query.
   *
   * By default, `.delete` will return a count of deleted records.
   *
   * Place `.select`, `.selectAll`, or `.get` before `.delete` to specify returning columns.
   *
   * Need to provide `.where`, `.findBy`, or `.find` conditions before calling `.delete`.
   * To prevent accidental deletion of all records, deleting without where will result in TypeScript and a runtime error.
   *
   * To delete all records without conditions add an empty `where`:
   *
   * ```ts
   * await db.table.where().delete();
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
   * `.delete` supports joining, under the hood the join is transformed to `USING` and `WHERE` statements:
   *
   * ```ts
   * // delete all users who have corresponding profile records:
   * db.table.join(Profile, 'profile.userId', 'user.id').where().delete();
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  delete<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return del(this);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _delete<T extends Query>(this: T, ..._args: DeleteArgs<T>): DeleteResult<T> {
    return _del(this);
  }
}
