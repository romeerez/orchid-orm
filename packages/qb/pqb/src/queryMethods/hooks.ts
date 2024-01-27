import { pushQueryArray, pushQueryValue } from '../query/queryUtils';
import { QueryColumns, StringKey } from 'orchid-core';
import { QueryAfterHook, QueryBeforeHook } from '../sql';
import { QueryBase } from '../query/queryBase';

// A function type for after-hook. Constructs type of data argument based on selected columns.
export type AfterHook<
  Select extends PropertyKey[],
  Shape extends QueryColumns,
  Selected extends QueryColumns = Pick<Shape, StringKey<Select[number]>>,
  Item = { [K in keyof Selected]: Selected[K]['outputType'] },
> = QueryAfterHook<Item[]>;

// Hook argument for selecting columns: array of column names of the table.
export type HookSelect<T extends QueryBase> = (keyof T['shape'])[];

// Possible action types to attach hook for.
export type HookAction = 'Create' | 'Update' | 'Delete';

// Save `before` hook into the query.
const before = <T extends QueryBase>(
  q: T,
  key: HookAction,
  cb: QueryBeforeHook,
): T => pushQueryValue(q, `before${key}`, cb);

// Save `after` hook into the query: this saves the function and the hook selection into the query data.
const after = <T extends QueryBase, S extends HookSelect<T>>(
  q: T,
  key: HookAction,
  select: S,
  cb: AfterHook<S, T['shape']>,
  commit?: boolean,
): T =>
  pushQueryArray(
    pushQueryValue(q, `after${key}${commit ? 'Commit' : ''}`, cb),
    `after${key}Select`,
    select,
  );

export const _queryHookBeforeQuery = <T extends QueryHooks>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return pushQueryValue(q, 'before', cb);
};

export const _queryHookAfterQuery = <T extends QueryHooks>(
  q: T,
  cb: QueryAfterHook,
): T => {
  return pushQueryValue(q, 'after', cb);
};

export const _queryHookBeforeCreate = <T extends QueryHooks>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Create', cb);
};

export const _queryHookAfterCreate = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Create', select, cb);
};

export const _queryHookAfterCreateCommit = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Create', select, cb, true);
};

export const _queryHookBeforeUpdate = <T extends QueryHooks>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Update', cb);
};

export const _queryHookAfterUpdate = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Update', select, cb);
};

export const _queryHookAfterUpdateCommit = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Update', select, cb, true);
};

export const _queryHookBeforeSave = <T extends QueryHooks>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(before(q, 'Create', cb), 'Update', cb);
};

export const _queryHookAfterSave = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(after(q, 'Create', select, cb), 'Update', select, cb);
};

export const _queryAfterSaveCommit = <
  T extends QueryHooks,
  S extends HookSelect<T>,
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

export const _queryHookBeforeDelete = <T extends QueryHooks>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Delete', cb);
};

export const _queryHookAfterDelete = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Delete', select, cb);
};

export const _queryHookAfterDeleteCommit = <
  T extends QueryHooks,
  S extends HookSelect<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Delete', select, cb, true);
};

export abstract class QueryHooks extends QueryBase {
  /**
   * Run the function before any kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeQuery<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeQuery(this.clone(), cb);
  }

  /**
   * Run the function after any kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   *
   * @param cb - function to call, first argument is the query result of type `unknown`, second argument is a query object
   */
  afterQuery<T extends QueryHooks>(this: T, cb: QueryAfterHook): T {
    return _queryHookAfterQuery(this.clone(), cb);
  }

  /**
   * Run the function before a `create` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeCreate<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeCreate(this.clone(), cb);
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
  afterCreate<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterCreate(this.clone(), select, cb);
  }

  /**
   * Run the function after transaction for a `create` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterCreateCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterCreateCommit(this.clone(), select, cb);
  }

  /**
   * Run the function before an `update` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeUpdate<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeUpdate(this.clone(), cb);
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
  afterUpdate<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterUpdate(this.clone(), select, cb);
  }

  /**
   * Run the function after transaction for an `update` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   * If no records were updated, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterUpdateCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterUpdateCommit(this.clone(), select, cb);
  }

  /**
   * Run the function before a `create` or an `update` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeSave<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeSave(this.clone(), cb);
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
  afterSave<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterSave(this.clone(), select, cb);
  }

  /**
   * Run the function after transaction for a `create` or an `update` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   * For the `update` query, if no records were updated, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterSaveCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryAfterSaveCommit(this.clone(), select, cb);
  }

  /**
   * Run the function before a `delete` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeDelete<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return _queryHookBeforeDelete(this.clone(), cb);
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
  afterDelete<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterDelete(this.clone(), select, cb);
  }

  /**
   * Run the function after transaction for a `delete` kind of query will be committed.
   * If the query wasn't wrapped in a transaction, will run after the query.
   * If no records were deleted, the hook *won't* run.
   *
   * @param select - list of columns to select for the hook
   * @param cb - function to call, first argument is the query result with selected columns, second argument is a query object
   */
  afterDeleteCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return _queryHookAfterDeleteCommit(this.clone(), select, cb);
  }
}
