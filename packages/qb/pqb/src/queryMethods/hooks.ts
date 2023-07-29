import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { ColumnsShapeBase, StringKey } from 'orchid-core';
import { QueryAfterHook, QueryBeforeHook } from '../sql';
import { QueryBase } from '../queryBase';

// A function type for after-hook. Constructs type of data argument based on selected columns.
export type AfterHook<
  Select extends PropertyKey[],
  Shape extends ColumnsShapeBase,
  Selected extends ColumnsShapeBase = Pick<Shape, StringKey<Select[number]>>,
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

export abstract class QueryHooks extends QueryBase {
  /**
   * Run the function before any kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeQuery<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return this.clone()._beforeQuery(cb);
  }
  _beforeQuery<T extends QueryBase>(this: T, cb: QueryBeforeHook): T {
    return pushQueryValue(this, 'before', cb);
  }

  /**
   * Run the function after any kind of query.
   * Enforces wrapping the query into a transaction.
   * The function will run after the query is succeeded, but before the transaction commit.
   *
   * @param cb - function to call, first argument is the query result of type `unknown`, second argument is a query object
   */
  afterQuery<T extends QueryHooks>(this: T, cb: QueryAfterHook): T {
    return this.clone()._afterQuery(cb);
  }
  _afterQuery<T extends QueryBase>(this: T, cb: QueryAfterHook): T {
    return pushQueryValue(this, 'after', cb);
  }

  /**
   * Run the function before a `create` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeCreate<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return this.clone()._beforeCreate(cb);
  }
  _beforeCreate<T extends QueryBase>(this: T, cb: QueryBeforeHook): T {
    return before(this, 'Create', cb);
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
    return this.clone()._afterCreate(select, cb);
  }
  _afterCreate<T extends QueryBase, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(this, 'Create', select, cb);
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
    return this.clone()._afterCreateCommit(select, cb);
  }
  _afterCreateCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(this, 'Create', select, cb, true);
  }

  /**
   * Run the function before an `update` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeUpdate<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return this.clone()._beforeUpdate(cb);
  }
  _beforeUpdate<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return before(this, 'Update', cb);
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
    return this.clone()._afterUpdate(select, cb);
  }
  _afterUpdate<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(this, 'Update', select, cb);
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
    return this.clone()._afterUpdateCommit(select, cb);
  }
  _afterUpdateCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(this, 'Update', select, cb, true);
  }

  /**
   * Run the function before a `create` or an `update` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeSave<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return this.clone()._beforeSave(cb);
  }
  _beforeSave<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return before(before(this, 'Create', cb), 'Update', cb);
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
    return this.clone()._afterSave(select, cb);
  }
  _afterSave<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(after(this, 'Create', select, cb), 'Update', select, cb);
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
    return this.clone()._afterSaveCommit(select, cb);
  }
  _afterSaveCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(
      after(this, 'Create', select, cb, true),
      'Update',
      select,
      cb,
      true,
    );
  }

  /**
   * Run the function before a `delete` kind of query.
   *
   * @param cb - function to call, first argument is a query object
   */
  beforeDelete<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return this.clone()._beforeDelete(cb);
  }
  _beforeDelete<T extends QueryHooks>(this: T, cb: QueryBeforeHook): T {
    return before(this, 'Delete', cb);
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
    return this.clone()._afterDelete(select, cb);
  }
  _afterDelete<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(this, 'Delete', select, cb);
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
    return this.clone()._afterDeleteCommit(select, cb);
  }
  _afterDeleteCommit<T extends QueryHooks, S extends HookSelect<T>>(
    this: T,
    select: S,
    cb: AfterHook<S, T['shape']>,
  ): T {
    return after(this, 'Delete', select, cb, true);
  }
}
