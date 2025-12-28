import { Query, QueryReturnType } from '../query';
import {
  _runAfterCommitHooks,
  commitSql,
  isInUserTransaction,
} from '../basic-features/transaction/transaction';
import { processComputedResult } from '../extra-features/computed/computed';
import { Column, ColumnsShape } from '../../columns';
import { HookPurpose } from '../extra-features/hooks/hooks.sql';
import { getValueKey } from '../basic-features/get/get-value-key';
import {
  AdapterBase,
  AfterCommitHook,
  QueryResult,
  TransactionState,
} from '../../adapters/adapter';
import {
  callWithThis,
  emptyArray,
  getFreeAlias,
  MaybePromise,
  RecordString,
  RecordUnknown,
  ShallowSimplify,
} from '../../utils';
import {
  ColumnParser,
  ColumnsParsers,
  getQueryParsers,
} from '../query-columns/query-column-parsers';
import { DelayedRelationSelect } from '../basic-features/select/delayed-relational-select';
import { _clone } from '../basic-features/clone/clone';
import { NotFoundError, QueryError } from '../errors';
import { SingleSql, SingleSqlItem, Sql } from '../sql/sql';
import { requirePrimaryKeys } from '../query-columns/primary-keys';
import { applyTransforms } from '../extra-features/data-transform/transform';
import {
  HandleResult,
  QueryAfterHook,
  QueryBeforeHookInternal,
} from '../query-data';
import { SelectAsValue, SelectItem } from '../basic-features/select/select.sql';
import { PickQueryReturnType } from '../pick-query-types';

// This is a standard Promise['then'] method
// copied from TS standard library because the original `then` is not decoupled from the Promise
export interface QueryThen<T> {
  <TResult1 = T, TResult2 = never>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2>;
} // This is a standard Promise['catch'] method

export type QueryThenShallowSimplify<T> = QueryThen<ShallowSimplify<T>>;

export type QueryThenShallowSimplifyArr<T> = QueryThen<ShallowSimplify<T>[]>;

export type QueryThenShallowSimplifyOptional<T> = QueryThen<
  ShallowSimplify<T> | undefined
>;

export type QueryThenByQuery<
  T extends PickQueryReturnType,
  Result extends Column.QueryColumns,
> = T['returnType'] extends undefined | 'all'
  ? QueryThenShallowSimplifyArr<ColumnsShape.Output<Result>>
  : T['returnType'] extends 'one'
  ? QueryThenShallowSimplifyOptional<ColumnsShape.Output<Result>>
  : T['returnType'] extends 'oneOrThrow'
  ? QueryThenShallowSimplify<ColumnsShape.Output<Result>>
  : T['returnType'] extends 'value'
  ? QueryThen<Result['value']['outputType'] | undefined>
  : T['returnType'] extends 'valueOrThrow'
  ? QueryThen<Result['value']['outputType']>
  : T['returnType'] extends 'rows'
  ? QueryThen<ColumnsShape.Output<Result>[keyof Result][][]>
  : T['returnType'] extends 'pluck'
  ? QueryThen<Result['pluck']['outputType'][]>
  : QueryThen<void>;

export type QueryThenByReturnType<
  T extends QueryReturnType,
  Result extends Column.QueryColumns,
> = T extends undefined | 'all'
  ? QueryThenShallowSimplifyArr<ColumnsShape.Output<Result>>
  : T extends 'one'
  ? QueryThenShallowSimplifyOptional<ColumnsShape.Output<Result>>
  : T extends 'oneOrThrow'
  ? QueryThenShallowSimplify<ColumnsShape.Output<Result>>
  : T extends 'value'
  ? QueryThen<Result['value']['outputType'] | undefined>
  : T extends 'valueOrThrow'
  ? QueryThen<Result['value']['outputType']>
  : T extends 'rows'
  ? QueryThen<ColumnsShape.Output<Result>[keyof Result][][]>
  : T extends 'pluck'
  ? QueryThen<Result['pluck']['outputType'][]>
  : QueryThen<void>;

// copied from TS standard library because the original `catch` is not decoupled from the Promise
export interface QueryCatch {
  <Q, TResult = never>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this: { then: (onfulfilled?: (value: Q) => any) => any },
    onrejected?: (reason: any) => TResult | PromiseLike<TResult>,
  ): Promise<Q | TResult>;
}

export const queryMethodByReturnType: {
  [K in string]: 'query' | 'arrays';
} = {
  undefined: 'query',
  all: 'query',
  rows: 'arrays',
  pluck: 'arrays',
  one: 'query',
  oneOrThrow: 'query',
  value: 'arrays',
  valueOrThrow: 'arrays',
  void: 'arrays',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resolve = (result: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reject = (error: any) => any;

export interface QueryCatchers {
  catchUniqueError<ThenResult, CatchResult>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this: { then: (onfulfilled?: (value: ThenResult) => any) => any },
    fn: (reason: QueryError) => CatchResult,
  ): Promise<ThenResult | CatchResult>;
}

export class Then implements QueryCatchers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(this: Query, fn: (reason: any) => unknown) {
    const q = _clone(this as unknown as Query);
    q.q.catch = true;
    return q.then(undefined, fn);
  }

  catchUniqueError(fn: (reason: QueryError) => unknown) {
    const q = _clone(this as unknown as Query);
    q.q.catch = true;
    return q.then(undefined, (err) => {
      if (err instanceof QueryError && err.isUnique) {
        return fn(err);
      } else {
        throw err;
      }
    }) as never;
  }
}

// For storing error with the stacktrace leading to the code which calls `await query`,
// using it later when catching query error.
let queryError: Error = undefined as unknown as Error;

// `query.then` getter: it must be a getter to store the error with stacktrace prior to executing `await`.
const getThen = function (
  this: Query,
): (this: Query, resolve?: Resolve, reject?: Reject) => Promise<unknown> {
  queryError = new Error();
  return maybeWrappedThen;
};

Object.defineProperty(Then.prototype, 'then', {
  configurable: true,
  get: getThen,
  set(value) {
    Object.defineProperty(this, 'then', {
      value,
    });
  },
});

function maybeWrappedThen(
  this: Query,
  resolve?: Resolve,
  reject?: Reject,
): Promise<unknown> {
  const { q } = this;

  const shouldCatch = q.catch;

  let beforeActionHooks: QueryBeforeHookInternal[] | undefined;
  let afterHooks: QueryAfterHook[] | undefined;
  let afterSaveHooks: QueryAfterHook[] | undefined;
  let afterCommitHooks: QueryAfterHook[] | undefined;
  let afterSaveCommitHooks: QueryAfterHook[] | undefined;
  if (q.type) {
    if (q.type === 'insert') {
      beforeActionHooks = q.beforeCreate;
      afterHooks = q.afterCreate;
      afterSaveHooks = q.afterSave;
      afterCommitHooks = q.afterCreateCommit;
      afterSaveCommitHooks = q.afterSaveCommit;
    } else if (q.type === 'update') {
      beforeActionHooks = q.beforeUpdate;
      afterHooks = q.afterUpdate;
      afterSaveHooks = q.afterSave;
      afterCommitHooks = q.afterUpdateCommit;
      afterSaveCommitHooks = q.afterSaveCommit;
    } else if (q.type === 'upsert') {
      if (q.upsertSecond) {
        beforeActionHooks = q.beforeCreate;
      } else if (q.upsertUpdate && q.updateData) {
        beforeActionHooks = q.beforeUpdate;
        afterHooks = q.afterUpdate;
        afterSaveHooks = q.afterSave;
        afterCommitHooks = q.afterUpdateCommit;
        afterSaveCommitHooks = q.afterSaveCommit;
      }
    } else if (q.type === 'delete') {
      beforeActionHooks = q.beforeDelete;
      afterHooks = q.afterDelete;
      afterCommitHooks = q.afterDeleteCommit;
    }
  }

  const { before } = q;
  const beforeHooks =
    before && beforeActionHooks
      ? [...before, ...beforeActionHooks]
      : before
      ? before
      : beforeActionHooks;

  const trx = this.internal.transactionStorage.getStore();
  if (
    (q.wrapInTransaction || (q.selectRelation && q.type) || afterHooks) &&
    !trx
  ) {
    return this.transaction(
      () =>
        new Promise((resolve, reject) => {
          const trx =
            this.internal.transactionStorage.getStore() as TransactionState;
          return then(
            this,
            trx.adapter,
            trx,
            beforeHooks,
            afterHooks,
            afterSaveHooks,
            afterCommitHooks,
            afterSaveCommitHooks,
            resolve,
            reject,
            shouldCatch,
          );
        }),
    ).then(resolve, reject);
  } else {
    return then(
      this,
      trx?.adapter || this.q.adapter,
      trx,
      beforeHooks,
      afterHooks,
      afterSaveHooks,
      afterCommitHooks,
      afterSaveCommitHooks,
      resolve,
      reject,
      shouldCatch,
    );
  }
}

const queriesNames: RecordString = {};
let nameI = 0;

const callAfterHook = function (
  this: [result: unknown[], q: Query],
  cb: QueryAfterHook,
): Promise<unknown> | unknown {
  return cb(this[0], this[1]);
};

const beginSql: SingleSqlItem = { text: 'BEGIN' };

const then = async (
  q: Query,
  adapter: AdapterBase,
  trx?: TransactionState,
  beforeHooks?: QueryBeforeHookInternal[],
  afterHooks?: QueryAfterHook[],
  afterSaveHooks?: QueryAfterHook[],
  afterCommitHooks?: QueryAfterHook[],
  afterSaveCommitHooks?: QueryAfterHook[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (result: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
  shouldCatch?: boolean,
): Promise<unknown> => {
  const { q: query } = q;

  let sql: (Sql & { name?: string }) | undefined;
  let logData: unknown | undefined;
  const log = trx?.log ?? query.log;

  // save error to a local variable before async operations
  const localError = queryError;

  try {
    if (beforeHooks) {
      await Promise.all(beforeHooks.map(callWithThis, q));
    }

    const localSql = (sql = q.toSQL());

    if (q.q.dynamicBefore) {
      let promises: Promise<unknown>[] | undefined;

      for (const data of q.q.dynamicBefore) {
        if (data.before) {
          for (const before of data.before) {
            const promise = before(q);
            if (promise) (promises ??= []).push(promise);
          }
        }
      }

      if (promises) await Promise.all(promises);
    }

    const { tableHook, cteHooks, delayedRelationSelect } = sql;
    const { returnType = 'all' } = query;
    const tempReturnType =
      tableHook?.select ||
      cteHooks?.hasSelect ||
      (returnType === 'rows' && q.q.batchParsers) ||
      delayedRelationSelect?.value
        ? 'all'
        : returnType;

    let result: unknown;
    let queryResult: QueryResult;
    let cteData: Record<string, unknown[]> | undefined;

    if ('text' in sql) {
      if (query.autoPreparedStatements) {
        sql.name =
          queriesNames[sql.text] ||
          (queriesNames[sql.text] = (nameI++).toString(36));
      }

      if (log) {
        logData = log.beforeQuery(sql);
      }

      const method = queryMethodByReturnType[tempReturnType];
      queryResult = await execQuery(adapter, method, sql, shouldCatch && trx);
      const { runAfterQuery } = sql;

      if (log) {
        log.afterQuery(sql, logData);
        // set sql to be undefined to prevent logging on error in case if afterHooks throws
        sql = undefined;
      }

      if (runAfterQuery) {
        const r = await runAfterQuery(queryResult);
        if (r) {
          return resolve ? resolve(r.result) : r.result;
        }
      }

      // Has to be after log, so the same logger instance can be used in the sub-suquential queries.
      // Useful for `upsert` and `orCreate`.
      if (query.patchResult) {
        await query.patchResult(q, tableHook?.select, queryResult);
      }

      if (localSql.cteHooks?.hasSelect) {
        const lastRowI = queryResult.rows.length - 1;
        const lastFieldI = queryResult.fields.length - 1;

        const fieldName =
          method === 'query' ? queryResult.fields[lastFieldI].name : lastFieldI;
        cteData = queryResult.rows[lastRowI][fieldName];
        queryResult.fields.length = lastFieldI;
        queryResult.rowCount--;
        queryResult.rows.length = lastRowI;

        if (method === 'query') {
          for (const row of queryResult.rows) {
            delete row[fieldName];
          }
        } else {
          for (const row of queryResult.rows) {
            row.length = lastFieldI;
          }
        }
      }

      result = query.handleResult(q, tempReturnType, queryResult, localSql);
    } else {
      // autoPreparedStatements in batch doesn't seem to make sense

      const queryMethod = queryMethodByReturnType[tempReturnType] as 'query';

      const queryBatch = async (batch: SingleSql[]) => {
        for (const item of batch) {
          sql = item;

          if (log) {
            logData = log.beforeQuery(sql);
          }

          const result = await execQuery(
            adapter,
            queryMethod,
            sql,
            shouldCatch && trx,
          );

          if (queryResult) {
            queryResult.rowCount += result.rowCount;
            queryResult.rows.push(...result.rows);
          } else {
            queryResult = result;
          }

          if (log) {
            log.afterQuery(sql, logData);
          }
        }

        // set sql to be undefined to prevent logging on error in case if afterHooks throws
        sql = undefined;
      };

      if (trx) {
        await queryBatch(sql.batch);
      } else {
        const { batch } = sql;

        if (log) logData = log.beforeQuery(beginSql);
        await adapter.transaction(undefined, async () => {
          if (log) log.afterQuery(beginSql, logData);
          const res = await queryBatch(batch);
          if (log) logData = log.beforeQuery(commitSql);
          return res;
        });
        if (log) log.afterQuery(commitSql, logData);
      }

      // runAfterQuery is not called because it's only for upsert,
      // while this batch branch is for batch insert

      if (query.patchResult) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await query.patchResult(q, tableHook?.select, queryResult!);
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      result = query.handleResult(q, tempReturnType, queryResult!, localSql);
    }

    // TODO: move computeds after parsing
    let tempColumns: Set<string> | undefined;
    let renames: RecordString | undefined;
    if (tableHook?.select) {
      for (const column of tableHook.select.keys()) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { as, temp } = tableHook.select.get(column)!;
        if (as) {
          (renames ??= {})[column] = as;
        }

        if (temp) {
          (tempColumns ??= new Set())?.add(temp);
        }
      }

      if (renames) {
        for (const record of result as RecordUnknown[]) {
          for (const a in renames) {
            const value = record[renames[a]];
            record[renames[a]] = record[a];
            record[a] = value;
          }
        }
      }

      if (query.selectedComputeds) {
        const promise = processComputedResult(query, result);
        if (promise) await promise;
      }
    }

    let cteAfterHooks: (() => unknown)[] | undefined;
    let cteAfterCommitHooks: (() => unknown)[] | undefined;
    if (localSql.cteHooks) {
      const addedAfterHooks = new Set<(data: unknown, query: any) => unknown>();
      const addedAfterCommitHooks = new Set<
        (data: unknown, query: any) => unknown
      >();

      interface TableData {
        data: {
          [K in HookPurpose | 'Save']?: unknown[];
        };
      }

      const dataPerSubQuery = new Map<string, TableData>();

      for (const cteName in localSql.cteHooks.tableHooks) {
        const hook = localSql.cteHooks.tableHooks[cteName];

        const purpose = hook.tableHook.hookPurpose as HookPurpose | undefined;
        if (!purpose) continue;

        let tableData = dataPerSubQuery.get(hook.table);
        if (!tableData) {
          tableData = { data: {} };
          dataPerSubQuery.set(hook.table, tableData);
        }

        const data = cteData?.[cteName];
        if (data) {
          const existing = tableData.data[purpose];
          tableData.data[purpose] = existing ? [...existing, ...data] : data;

          if (purpose === 'Create' || purpose === 'Update') {
            tableData.data.Save = tableData.data.Save
              ? [...tableData.data.Save, ...data]
              : data;
          }

          let hasParsers: boolean | undefined;
          const parsers: ColumnsParsers = {};
          for (const key in hook.shape) {
            if ((hook.shape[key] as Column)._parse) {
              hasParsers = true;
              parsers[key] = (hook.shape[key] as Column)._parse;
            }
          }

          if (hasParsers) {
            for (const row of data) {
              parseRecord(parsers, row);
            }
          }
        }
      }

      for (const cteName in localSql.cteHooks.tableHooks) {
        const hook = localSql.cteHooks.tableHooks[cteName];
        const { tableHook } = hook;

        const purpose = tableHook.hookPurpose as HookPurpose | undefined;
        const tableData = dataPerSubQuery.get(hook.table);
        if (!purpose || !tableData) continue;

        for (const purpose of ['Create', 'Update', 'Delete', 'Save'] as const) {
          const data = tableData.data[purpose];
          if (!data) continue;

          const afterKey = `after${purpose}` as const;
          const after = tableHook[afterKey];
          if (after) {
            const arr = (cteAfterHooks ??= []);
            for (const fn of after) {
              const hookData = addedAfterHooks.has(fn);
              if (!hookData) {
                addedAfterHooks.add(fn);
                arr.push(() => fn(data, q));
              }
            }
          }

          const afterCommitKey = `after${purpose}Commit` as const;
          const afterCommit = tableHook[afterCommitKey];
          if (afterCommit) {
            const arr = (cteAfterHooks ??= []);
            for (const fn of afterCommit) {
              const hookData = addedAfterCommitHooks.has(fn);
              if (!hookData) {
                addedAfterCommitHooks.add(fn);
                arr.push(() => fn(data, q));
              }
            }
          }
        }
      }
    }

    const queryAfter = query.after;
    const hasAfterHook =
      afterHooks ||
      afterSaveHooks ||
      afterCommitHooks ||
      afterSaveCommitHooks ||
      queryAfter ||
      cteAfterHooks ||
      cteAfterCommitHooks;
    if (hasAfterHook) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (!queryResult!.rowCount) {
        afterHooks =
          afterSaveHooks =
          afterCommitHooks =
          afterSaveCommitHooks =
            undefined;
      }

      if (afterHooks || afterSaveHooks || queryAfter || cteAfterHooks) {
        const args = [result, q];
        await Promise.all(
          [
            ...(afterHooks || emptyArray),
            ...(afterSaveHooks || emptyArray),
            ...(queryAfter || emptyArray),
            ...(cteAfterHooks || emptyArray),
          ].map(callAfterHook, args),
        );
      }

      // afterCommitHooks are executed later after transaction commit,
      // or, if we don't have transaction, they are executed intentionally after other after hooks
      if (afterCommitHooks || afterSaveCommitHooks || cteAfterCommitHooks) {
        const afterActionAndSaveCommit = (afterCommitHooks ||
          afterSaveCommitHooks) && [
          ...(afterCommitHooks || emptyArray),
          ...(afterSaveCommitHooks || emptyArray),
        ];

        if (isInUserTransaction(trx)) {
          if (afterActionAndSaveCommit) {
            (trx.afterCommit ??= []).push(
              result as unknown[],
              q,
              afterActionAndSaveCommit,
            );
          }

          if (cteAfterCommitHooks) {
            (trx.afterCommit ??= []).push(
              result as unknown[],
              q,
              cteAfterCommitHooks,
            );
          }
        } else {
          // result can be transformed later, reference the current form to use it in hook.
          const localResult = result as unknown[];
          // to suppress throws of sync afterCommit hooks.
          queueMicrotask(async () => {
            const promises: (unknown | Promise<unknown>)[] = [];
            if (afterActionAndSaveCommit) {
              for (const fn of afterActionAndSaveCommit) {
                try {
                  promises.push(
                    (fn as unknown as AfterCommitHook)(localResult, q),
                  );
                } catch (err) {
                  promises.push(Promise.reject(err));
                }
              }
            }

            if (cteAfterCommitHooks) {
              for (const fn of cteAfterCommitHooks) {
                try {
                  promises.push(fn());
                } catch (err) {
                  promises.push(Promise.reject(err));
                }
              }
            }

            await _runAfterCommitHooks(
              localResult,
              promises,
              () =>
                [
                  ...(afterCommitHooks || emptyArray),
                  ...(cteAfterCommitHooks || emptyArray),
                ].map((h) => h.name),
              q.q.catchAfterCommitErrors,
            );
          });
        }
      }
    }

    if (delayedRelationSelect?.value) {
      const q = delayedRelationSelect.query as Query;

      const primaryKeys = requirePrimaryKeys(
        q,
        'Cannot select a relation of a table that has no primary keys',
      );
      const selectQuery = q.clone();
      selectQuery.q.type = selectQuery.q.returnType = undefined;

      const matchSourceTableIds: RecordUnknown = {};
      for (const pkey of primaryKeys) {
        matchSourceTableIds[pkey] = {
          in: (result as RecordUnknown[]).map((row) => row[pkey]),
        };
      }
      (selectQuery.q.and ??= []).push(matchSourceTableIds);

      const relationsSelect = delayedRelationSelect.value as Record<
        string,
        Query
      >;

      const selectAs: SelectAsValue = { ...relationsSelect };

      const select: SelectItem[] = [{ selectAs }];

      const relationKeyAliases = primaryKeys.map((key) => {
        if (key in selectAs) {
          const as = getFreeAlias(selectAs, key);
          selectAs[as] = key;
          return as;
        } else {
          select.push(key);
          return key;
        }
      });

      selectQuery.q.select = select;

      const relationsResult = (await selectQuery) as RecordUnknown[];
      for (const row of result as RecordUnknown[]) {
        const relationRow = relationsResult.find((relationRow) => {
          return !primaryKeys.some(
            (key, i) => relationRow[relationKeyAliases[i]] !== row[key],
          );
        });
        if (relationRow) {
          Object.assign(row, relationRow);
        }
      }

      // when relation is loaded under the same key as a transient primary key:
      // no need to rename it because the relation was already loaded under the key name.
      if (renames) {
        for (const key in relationsSelect) {
          if (key in renames) {
            delete renames[key];
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const promise = parseBatch(q, queryResult!, delayedRelationSelect);
    if (promise) await promise;

    // can be set by hooks or by computed columns
    if (tableHook?.select || tempReturnType !== returnType) {
      if (renames) {
        // to not mutate the original result because it's passed to hooks
        const renamedResult = Array.from({
          length: (result as RecordUnknown[]).length,
        });

        for (
          let i = 0, len = (result as RecordUnknown[]).length;
          i < len;
          ++i
        ) {
          const record = (result as RecordUnknown[])[i];
          const renamedRecord = (renamedResult[i] = { ...record });
          for (const a in renames) {
            // TODO: no need to assign if the one or another is in `tempColumns`
            renamedRecord[a] = record[renames[a]];
            renamedRecord[renames[a]] = record[a];
          }
        }

        result = renamedResult;
      }

      result = filterResult(
        q,
        returnType,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        queryResult!,
        result,
        tempColumns,
        hasAfterHook,
      );
    }

    if (query.transform) {
      result = applyTransforms(query, returnType, query.transform, result);
    }

    return resolve ? resolve(result) : result;
  } catch (err) {
    let error;
    if (err instanceof adapter.errorClass) {
      if (
        // a special not found error thrown by 'not-found'::int
        'code' in err &&
        err.code === '22P02' &&
        err.message.endsWith(`"not-found"`)
      ) {
        error = new NotFoundError(q);
      } else {
        error = new (q.error as unknown as new () => QueryError)();
        adapter.assignError(error, err);
      }
      error.cause = localError;
    } else {
      error = err;
      if (error instanceof Error) {
        error.cause = localError;
      }
    }

    // shift stack by one to point to the calling code
    const stack = localError.stack;
    if (stack) {
      const from = stack.indexOf('\n');
      if (from !== -1) {
        const to = stack.indexOf('\n', from + 1);
        if (to !== -1) {
          localError.stack = stack.slice(0, from) + stack.slice(to);
        }
      }
    }

    if (log && sql) {
      log.onError(error as Error, sql as SingleSqlItem, logData);
    }

    if (reject) return reject(error);

    throw error;
  }
};

/**
 * Executes a query and in the case there are rows, but nothing was selected,
 * it populates the response with empty objects,
 * because user might expect empty objects to be returned for an empty select.
 */
const execQuery = (
  adapter: AdapterBase,
  method: 'query' | 'arrays',
  sql: SingleSql,
  catchTrx: TransactionState | false | undefined,
) => {
  const catchingSavepoint = catchTrx
    ? `s${(catchTrx.catchI = (catchTrx.catchI || 0) + 1)}`
    : undefined;

  return (
    adapter[method as 'query'](
      sql.text,
      sql.values,
      catchingSavepoint,
    ) as Promise<QueryResult>
  ).then((result) => {
    if (result.rowCount && !result.rows.length) {
      result.rows.length = result.rowCount;
      result.rows.fill({});
    }

    return result;
  });
};

export const handleResult: HandleResult = (
  q,
  returnType,
  result,
  sql,
  isSubQuery,
) => {
  const parsers = getQueryParsers(q, sql.tableHook?.select);

  switch (returnType) {
    case 'all': {
      if (q.q.throwOnNotFound && result.rows.length === 0)
        throw new NotFoundError(q);

      const { rows } = result;

      if (parsers) {
        for (const row of rows) {
          parseRecord(parsers, row);
        }
      }

      return rows;
    }
    case 'one': {
      const { rows } = result;
      if (!rows.length) return;

      if (parsers) parseRecord(parsers, rows[0]);

      return rows[0];
    }
    case 'oneOrThrow': {
      const { rows } = result;
      if (!rows.length) throw new NotFoundError(q);

      if (parsers) parseRecord(parsers, rows[0]);

      return rows[0];
    }
    case 'rows': {
      const { rows } = result;

      if (parsers) {
        parseRows(parsers, result.fields, rows);
      }

      return rows;
    }
    case 'pluck': {
      const { rows } = result;

      parsePluck(parsers, isSubQuery, rows);

      return rows;
    }
    case 'value': {
      const { rows } = result;

      return rows[0]?.[0] !== undefined
        ? parseValue(rows[0][0], parsers)
        : q.q.notFoundDefault;
    }
    case 'valueOrThrow': {
      if (q.q.returning) {
        if (q.q.throwOnNotFound && result.rowCount === 0) {
          throw new NotFoundError(q);
        }
        return result.rowCount;
      }

      const { rows } = result;

      if (rows[0]?.[0] === undefined) throw new NotFoundError(q);
      return parseValue(rows[0][0], parsers);
    }
    case 'void': {
      return;
    }
  }
};

const parseBatch = (
  q: Query,
  queryResult: QueryResult,
  delayedRelationSelect?: DelayedRelationSelect,
): MaybePromise<void> => {
  let promises: Promise<void>[] | undefined;

  /**
   * In case of delayedRelationSelect, the first query does insert/update/delete,
   * it must not run batchParsers because it doesn't have the data yet.
   * The second query loads data and performs batchParsers.
   */
  if (q.q.batchParsers && !delayedRelationSelect?.value) {
    for (const parser of q.q.batchParsers) {
      const res = parser.fn(parser.path, queryResult);
      if (res) (promises ??= []).push(res);
    }
  }

  return promises && (Promise.all(promises) as never);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseRecord = (parsers: ColumnsParsers, row: any): unknown => {
  for (const key in parsers) {
    if (key in row) {
      row[key] = (parsers[key] as ColumnParser)(row[key]);
    }
  }
  return row;
};

const parseRows = (
  parsers: ColumnsParsers,
  fields: { name: string }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[],
): void => {
  for (let i = fields.length - 1; i >= 0; i--) {
    const parser = parsers[fields[i].name];
    if (parser) {
      for (const row of rows) {
        row[i] = parser(row[i]);
      }
    }
  }
};

const parsePluck = (
  parsers: ColumnsParsers | undefined,
  isSubQuery: true | undefined,
  rows: unknown[],
): void => {
  const pluck = parsers?.pluck;
  if (pluck) {
    for (let i = 0; i < rows.length; i++) {
      rows[i] = pluck(isSubQuery ? rows[i] : (rows[i] as RecordUnknown)[0]);
    }
  } else if (!isSubQuery) {
    for (let i = 0; i < rows.length; i++) {
      rows[i] = (rows[i] as RecordUnknown)[0];
    }
  }
};

const parseValue = (value: unknown, parsers?: ColumnsParsers): unknown => {
  const parser = parsers?.[getValueKey];
  return parser ? parser(value) : value;
};

export const filterResult = (
  q: Query,
  returnType: QueryReturnType,
  queryResult: QueryResult,
  result: unknown,
  tempColumns: Set<string> | undefined,
  // result should not be mutated when having hooks, because hook may want to access the data later
  hasAfterHook?: unknown,
): unknown => {
  if (returnType === 'all') {
    return filterAllResult(result, tempColumns, hasAfterHook);
  }

  if (returnType === 'oneOrThrow' || returnType === 'one') {
    let row = (result as RecordUnknown[])[0];
    if (!row) {
      if (returnType === 'oneOrThrow') throw new NotFoundError(q);
      return undefined;
    } else if (!tempColumns?.size) {
      return row;
    } else {
      if (hasAfterHook) row = { ...row };

      for (const column of tempColumns) {
        delete row[column];
      }

      return row;
    }
  }

  if (returnType === 'value') {
    return (result as RecordUnknown[])[0]?.[
      getFirstResultKey(q, queryResult) as string
    ];
  }

  if (returnType === 'valueOrThrow') {
    if (q.q.returning) {
      return queryResult.rowCount;
    }

    const row = (result as RecordUnknown[])[0];
    if (!row) throw new NotFoundError(q);

    return row[getFirstResultKey(q, queryResult) as string];
  }

  if (returnType === 'pluck') {
    const key = getFirstResultKey(q, queryResult) as string;
    return (result as RecordUnknown[]).map((row) => row[key]);
  }

  if (returnType === 'rows') {
    result = filterAllResult(result, tempColumns, hasAfterHook);
    return (result as RecordUnknown[]).map((record) => Object.values(record));
  }

  return;
};

const getFirstResultKey = (q: Query, queryResult: QueryResult) => {
  if (q.q.select) {
    return queryResult.fields[0].name;
  } else {
    for (const key in q.q.selectedComputeds) {
      return key;
    }
  }
  return;
};

const filterAllResult = (
  result: unknown,
  tempColumns: Set<string> | undefined,
  hasAfterHook: unknown,
) => {
  if (tempColumns?.size) {
    if (hasAfterHook) {
      return (result as RecordUnknown[]).map((data) => {
        const record = { ...data };
        for (const key of tempColumns) {
          delete record[key];
        }
        return record;
      });
    } else {
      for (const record of result as RecordUnknown[]) {
        for (const key of tempColumns) {
          delete record[key];
        }
      }
    }
  }
  return result;
};
