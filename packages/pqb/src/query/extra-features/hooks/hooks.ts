import { IsQuery, QueryOrExpression, QueryReturnType } from '../../query';
import { AfterCommitErrorHandler } from '../../basic-features/transaction/transaction';
import { Column } from '../../../columns';
import {
  PickQueryInputType,
  PickQueryQ,
  PickQueryShape,
} from '../../pick-query-types';
import { _clone } from '../../basic-features/clone/clone';
import { RecordString, RecordUnknown } from '../../../utils';
import { QueryBatchResult } from '../../basic-features/select/select.utils';
import {
  pushQueryValueImmutable,
  QueryAfterHook,
  QueryBeforeHook,
  QueryBeforeHookInternal,
} from '../../query-data';

// A function type for after-hook. Constructs type of data argument based on selected columns.
export type AfterHook<
  Select extends PropertyKey[],
  Shape extends Column.QueryColumns,
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
export type HookAction = 'Create' | 'Update' | 'Save' | 'Delete';

// Save `before` hook into the query.
const before = <T>(q: T, key: HookAction, cb: QueryBeforeHookInternal): T =>
  pushQueryValueImmutable(q as IsQuery, `before${key}`, cb) as never;

// Save `after` hook into the query: this saves the function and the hook selection into the query data.
const after = <T extends PickQueryShape, S extends HookSelectArg<T>>(
  query: T,
  key: HookAction,
  select: S,
  cb: AfterHook<S, T['shape']>,
  commit?: boolean,
): T => {
  const q = query as unknown as PickQueryQ;
  pushQueryValueImmutable(
    q as never,
    `after${key}${commit ? 'Commit' : ''}`,
    cb,
  );

  const prop = `after${key}Select` as const;
  const set = (q.q[prop] = new Set(q.q[prop]));
  for (const column of select) {
    set.add(column);
  }

  return query;
};

export const _queryHookBeforeQuery = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHookInternal,
): T => {
  return pushQueryValueImmutable(q as never, 'before', cb);
};

export const _queryHookAfterQuery = <T extends PickQueryShape>(
  q: T,
  cb: QueryAfterHook,
): T => {
  return pushQueryValueImmutable(q as never, 'after', cb);
};

export class QueryHookUtils<T extends PickQueryInputType> {
  constructor(
    public query: IsQuery,
    public columns: string[],
    private key: 'hookCreateSet' | 'hookUpdateSet',
  ) {}

  set = (data: {
    [K in keyof T['inputType']]?:
      | T['inputType'][K]
      | (() => QueryOrExpression<T['inputType'][K]>);
  }) => {
    const set: RecordUnknown = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        set[key] = data[key];
      }
    }
    pushQueryValueImmutable(this.query, this.key, set);
  };
}

export const finalizeNestedHookSelect = (
  batches: QueryBatchResult[],
  returnType: QueryReturnType,
  tempColumns: Set<string> | undefined,
  renames: RecordString | undefined,
  key: string,
) => {
  if (renames) {
    for (const { data } of batches) {
      for (const record of data) {
        if (record) {
          for (const a in renames) {
            record[a] = record[renames[a]];
          }
        }
      }
    }
  }

  if (tempColumns?.size) {
    for (const { data } of batches) {
      for (const record of data) {
        if (record) {
          for (const key of tempColumns) {
            delete record[key];
          }
        }
      }
    }
  }

  if (returnType === 'one' || returnType === 'oneOrThrow') {
    for (const batch of batches) {
      batch.data = batch.data[0];
    }
  } else if (returnType === 'pluck') {
    for (const { data } of batches) {
      for (let i = 0; i < data.length; i++) {
        data[i] = data[i][key];
      }
    }
  } else if (returnType === 'value' || returnType === 'valueOrThrow') {
    for (const item of batches) {
      item.parent[item.key] = item.data[0]?.[key];
    }
  }
};

export const _queryHookBeforeCreate = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHook,
): T => {
  return before(q, 'Create', (q) =>
    cb(new QueryHookUtils(q, q.q.columns, 'hookCreateSet')),
  );
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
  return before(q, 'Update', (q) => {
    const columns: string[] = [];
    for (const item of q.q.updateData) {
      if (typeof item === 'object') {
        columns.push(...Object.keys(item));
      }
    }

    return cb(new QueryHookUtils(q, columns, 'hookUpdateSet'));
  });
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
  return _queryHookBeforeUpdate(_queryHookBeforeCreate(q, cb), cb);
};

export const _queryHookAfterSave = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Save', select, cb);
};

export const _queryAfterSaveCommit = <
  T extends PickQueryShape,
  S extends HookSelectArg<T>,
>(
  q: T,
  select: S,
  cb: AfterHook<S, T['shape']>,
): T => {
  return after(q, 'Save', select, cb, true);
};

export const _queryHookBeforeDelete = <T extends PickQueryShape>(
  q: T,
  cb: QueryBeforeHookInternal,
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
  beforeQuery<T>(this: T, cb: QueryBeforeHookInternal): T {
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
  beforeDelete<T>(this: T, cb: QueryBeforeHookInternal): T {
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
