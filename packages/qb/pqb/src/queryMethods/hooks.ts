import { _clone, pushQueryValueImmutable } from '../query/queryUtils';
import { PickQueryShape, QueryColumns } from 'orchid-core';
import { QueryAfterHook, QueryBeforeHook } from '../sql';
import { PickQueryQ } from '../query/query';
import { AfterCommitErrorHandler } from './transaction';

// A function type for after-hook. Constructs type of data argument based on selected columns.
export type AfterHook<
  Select extends PropertyKey[],
  Shape extends QueryColumns,
> = QueryAfterHook<
  {
    [K in Select[number]]: K extends keyof Shape
      ? Shape[K]['outputType']
      : never;
  }[]
>;

// Hook argument for selecting columns: array of column names of the table.
export type HookSelectArg<T extends PickQueryShape> = (keyof T['shape'] &
  string)[];

// Possible action types to attach hook for.
export type HookAction = 'Create' | 'Update' | 'Delete';

// Save `before` hook into the query.
const before = <T>(q: T, key: HookAction, cb: QueryBeforeHook): T =>
  pushQueryValueImmutable(q as PickQueryQ, `before${key}`, cb) as never;

// Save `after` hook into the query: this saves the function and the hook selection into the query data.
const after = <T extends PickQueryShape, S extends HookSelectArg<T>>(
  query: T,
  key: HookAction,
  select: S,
  cb: AfterHook<S, T['shape']>,
  commit?: boolean,
): T => {
  const q = query as unknown as PickQueryQ;
  pushQueryValueImmutable(q, `after${key}${commit ? 'Commit' : ''}`, cb);

  const prop = `after${key}Select` as const;
  const set = (q.q[prop] = new Set(q.q[prop]));
  for (const column of select) {
    set.add(column);
  }

  return query;
};

export const _queryHookBeforeQuery = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return pushQueryValueImmutable(q as never, 'before', cb);
};

export const _queryHookAfterQuery = <T extends PickQueryShape>(
  q: T,
  cb: QueryAfterHook,
): T => {
  return pushQueryValueImmutable(q as never, 'after', cb);
};

export const _queryHookBeforeCreate = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Create', cb);
};

export const _queryHookAfterCreate = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Create', select, cb);
};

export const _queryHookAfterCreateCommit = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Create', select, cb, true);
};

export const _queryHookBeforeUpdate = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Update', cb);
};

export const _queryHookAfterUpdate = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Update', select, cb);
};

export const _queryHookAfterUpdateCommit = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Update', select, cb, true);
};

export const _queryHookBeforeSave = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(before(q, 'Create', cb), 'Update', cb);
};

export const _queryHookAfterSave = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(after(q, 'Create', select, cb), 'Update', select, cb);
};

export const _queryAfterSaveCommit = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(
    after(q, 'Create', select, cb, true),
    'Update',
    select,
    cb,
    true,
  );
};

export const _queryHookBeforeDelete = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Delete', cb);
};

export const _queryHookAfterDelete = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Delete', select, cb);
};

export const _queryHookAfterDeleteCommit = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Delete', select, cb, true);
};

export abstract class QueryHooks {
  /**
   * Run the function before any kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeQuery<T>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeQuery(_clone(this), cb) as T;
  }

  /**
   * Run the function after any kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   *
   * @param cb - function to call, first argument is the query result of type `unknown`, second argument is a query object
   */
  afterQuery<T>(this: T, cb: QueryAfterHook): T {
    return _queryHookAfterQuery(_clone(this), cb) as T;
  }

  /**
   * Run the function before a `create` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeCreate<T>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeCreate(_clone(this), cb) as T;
  }

  /**
   * Run the function after a `create` kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   * Queries inside the function will run in the same transaction as the target query.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterCreate<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterCreate(_clone(this), select, cb) as unknown as T;
  }

  /**
   * Run the function after transaction for a `create` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterCreateCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterCreateCommit(
      _clone(this),
      select,
      cb,
    ) as unknown as T;
  }

  /**
   * Run the function before an `update` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeUpdate<T>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeUpdate(_clone(this), cb) as T;
  }

  /**
   * Run the function after an `update` kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   * Queries inside the function will run in the same transaction as the target query.
   * If no records were updated, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterUpdate<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterUpdate(_clone(this), select, cb) as unknown as T;
  }

  /**
   * Run the function after transaction for an `update` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   * If no records were updated, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterUpdateCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterUpdateCommit(
      _clone(this),
      select,
      cb,
    ) as unknown as T;
  }

  /**
   * Run the function before a `create` or an `update` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeSave<T>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeSave(_clone(this), cb) as T;
  }

  /**
   * Run the function after a `create` or an `update` kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   * Queries inside the function will run in the same transaction as the target query.
   * For the `update` query, if no records were updated, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterSave<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterSave(_clone(this), select, cb) as unknown as T;
  }

  /**
   * Run the function after transaction for a `create` or an `update` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   * For the `update` query, if no records were updated, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterSaveCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryAfterSaveCommit(_clone(this), select, cb) as unknown as T;
  }

  /**
   * Run the function before a `delete` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeDelete<T>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeDelete(_clone(this), cb) as T;
  }

  /**
   * Run the function after a `delete` kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   * Queries inside the function will run in the same transaction as the target query.
   * If no records were deleted, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterDelete<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterDelete(_clone(this), select, cb) as unknown as T;
  }

  /**
   * Run the function after transaction for a `delete` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   * If no records were deleted, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterDeleteCommit<T extends PickQueryShape, S extends HookSelectArg<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterDeleteCommit(
      _clone(this),
      select,
      cb,
    ) as unknown as T;
  }

  /**
   * Add `catchAfterCommitError` to the query to catch possible errors that are coming from after commit hooks.
   *
   * When it is used, the transaction will return its result disregarding of a failed hook.
   *
   * Without `catchAfterCommitError`, the transaction function throws and won't return result.
   * Result is still accessible from the error object [AfterCommitError](#AfterCommitError).
   *
   * ```ts
   * const result = await db
   *   .$transaction(async () => {
   *     return db.table.create(data);
   *   })
   *   .catchAfterCommitError((err) => {
   *     // err is instance of AfterCommitError (see below)
   *   })
   *   // can be added multiple times, all catchers will be executed
   *   .catchAfterCommitError((err) => {});
   *
   * // result is available even if an after commit hook has failed
   * result.id;
   * ```
   */
  catchAfterCommitError<T>(this: T, fn: AfterCommitErrorHandler): T {
    const q = _clone(this);
    pushQueryValueImmutable(q, 'catchAfterCommitErrors', fn);
    return q as T;
  }
}
