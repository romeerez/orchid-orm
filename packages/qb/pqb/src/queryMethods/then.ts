import { Query } from '../query/query';
import { NotFoundError, QueryError } from '../errors';
import { QueryResult } from '../adapter';
import { HandleResult, QueryAfterHook, QueryBeforeHook } from '../sql';
import pg from 'pg';
import {
  AdapterBase,
  applyTransforms,
  callWithThis,
  ColumnParser,
  ColumnsParsers,
  emptyArray,
  getValueKey,
  MaybePromise,
  QueryReturnType,
  RecordString,
  RecordUnknown,
  SingleSqlItem,
  Sql,
  TransactionState,
} from 'orchid-core';
import { commitSql } from './transaction';
import { processComputedResult } from '../modules/computed';

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
  rowCount: 'arrays',
  void: 'arrays',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resolve = (result: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reject = (error: any) => any;

export class Then {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(this: Query, fn: (reason: any) => unknown) {
    return this.then(undefined, fn);
  }
}

// For storing error with the stacktrace leading to the code which calls `await query`,
// using it later when catching query error.
let queryError: Error = undefined as unknown as Error;

// `query.then` getter: it must be a getter to store the error with stacktrace prior to executing `await`.
let getThen: (
  this: Query,
) => (this: Query, resolve?: Resolve, reject?: Reject) => Promise<unknown>;

// workaround for the bun issue: https://github.com/romeerez/orchid-orm/issues/198
if (process.versions.bun) {
  getThen = function () {
    queryError = new Error();

    // In rake-db `then` might be called on a lightweight query object that has no `internal`.
    if (!this.internal) return maybeWrappedThen;

    // Value in the store exists only before the call of the returned function.
    const trx = this.internal.transactionStorage.getStore();
    if (!trx) return maybeWrappedThen;

    return (resolve, reject) => {
      // Here `transactionStorage.getStore()` tempReturnType undefined,
      // need to set the `trx` value to the store to workaround the bug.
      return this.internal.transactionStorage.run(trx, () => {
        return maybeWrappedThen.call(this, resolve, reject);
      });
    };
  };
} else {
  getThen = function () {
    queryError = new Error();
    return maybeWrappedThen;
  };
}

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

  let beforeHooks: QueryBeforeHook[] | undefined;
  let afterHooks: QueryAfterHook[] | undefined;
  let afterCommitHooks: QueryAfterHook[] | undefined;
  if (q.type) {
    if (q.type === 'insert') {
      beforeHooks = q.beforeCreate;
      afterHooks = q.afterCreate;
      afterCommitHooks = q.afterCreateCommit;
    } else if (q.type === 'update') {
      beforeHooks = q.beforeUpdate;
      afterHooks = q.afterUpdate;
      afterCommitHooks = q.afterUpdateCommit;
    } else if (q.type === 'delete') {
      beforeHooks = q.beforeDelete;
      afterHooks = q.afterDelete;
      afterCommitHooks = q.afterDeleteCommit;
    }
  }

  const trx = this.internal.transactionStorage.getStore();
  if ((q.wrapInTransaction || afterHooks) && !trx) {
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
            afterCommitHooks,
            resolve,
            reject,
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
      afterCommitHooks,
      resolve,
      reject,
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
  beforeHooks?: QueryBeforeHook[],
  afterHooks?: QueryAfterHook[],
  afterCommitHooks?: QueryAfterHook[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (result: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
): Promise<unknown> => {
  const { q: query } = q;

  let sql: (Sql & { name?: string }) | undefined;
  let logData: unknown | undefined;
  const log = trx?.log ?? query.log;

  // save error to a local variable before async operations
  const localError = queryError;

  try {
    if (beforeHooks || query.before) {
      await Promise.all(
        [...(beforeHooks || emptyArray), ...(query.before || emptyArray)].map(
          callWithThis,
          q,
        ),
      );
    }

    sql = q.toSQL();
    const { hookSelect } = sql;
    const { returnType = 'all' } = query;
    const tempReturnType =
      hookSelect || (returnType === 'rows' && q.q.batchParsers)
        ? 'all'
        : returnType;

    let result: unknown;
    let queryResult;

    if ('text' in sql) {
      if (query.autoPreparedStatements) {
        sql.name =
          queriesNames[sql.text] ||
          (queriesNames[sql.text] = (nameI++).toString(36));
      }

      if (log) {
        logData = log.beforeQuery(sql);
      }

      queryResult = (await adapter[
        queryMethodByReturnType[tempReturnType] as 'query'
      ](sql)) as QueryResult;

      if (query.patchResult) {
        await query.patchResult(q, queryResult);
      }

      if (log) {
        log.afterQuery(sql, logData);
        // set sql to be undefined to prevent logging on error in case if afterHooks throws
        sql = undefined;
      }

      result = query.handleResult(q, tempReturnType, queryResult);
    } else {
      // autoPreparedStatements in batch doesn't seem to make sense

      const queryMethod = queryMethodByReturnType[tempReturnType] as 'query';

      if (!trx) {
        if (log) logData = log.beforeQuery(beginSql);
        await adapter.arrays(beginSql);
        if (log) log.afterQuery(beginSql, logData);
      }

      for (const item of sql.batch) {
        sql = item;

        if (log) {
          logData = log.beforeQuery(sql);
        }

        const result = (await adapter[queryMethod](sql)) as QueryResult;

        if (queryResult) {
          queryResult.rowCount += result.rowCount;
          queryResult.rows.push(...result.rows);
        } else {
          queryResult = result;
        }

        if (log) {
          log.afterQuery(sql, logData);
          // set sql to be undefined to prevent logging on error in case if afterHooks throws
          sql = undefined;
        }
      }

      if (!trx) {
        if (log) logData = log.beforeQuery(commitSql);
        await adapter.arrays(commitSql);
        if (log) log.afterQuery(commitSql, logData);
      }

      if (query.patchResult) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await query.patchResult(q, queryResult!);
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      result = query.handleResult(q, tempReturnType, queryResult!);
    }

    if (
      result &&
      typeof result === 'object' &&
      typeof (result as RecordUnknown).then === 'function'
    ) {
      result = await result;
    }

    // TODO: move computeds after parsing
    let tempColumns: Set<string> | undefined;
    let renames: RecordString | undefined;
    if (hookSelect) {
      for (const column of hookSelect.keys()) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const as = hookSelect!.get(column)!.as;
        if (as) (renames ??= {})[column] = as;

        (tempColumns ??= new Set())?.add(as || column);
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

    const hasAfterHook = afterHooks || afterCommitHooks || query.after;
    if (hasAfterHook) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      if (queryResult!.rowCount) {
        if (afterHooks || query.after) {
          const args = [result, q];
          await Promise.all(
            [...(afterHooks || emptyArray), ...(query.after || emptyArray)].map(
              callAfterHook,
              args,
            ),
          );
        }

        // afterCommitHooks are executed later after transaction commit,
        // or, if we don't have transaction, they are executed intentionally after other after hooks
        if (afterCommitHooks && trx) {
          (trx.afterCommit ??= []).push(
            result as unknown[],
            q,
            afterCommitHooks,
          );
        } else if (afterCommitHooks) {
          const args = [result, q];
          await Promise.all(afterCommitHooks.map(callAfterHook, args));
        }
      } else if (query.after) {
        const args = [result, q];
        await Promise.all(query.after.map(callAfterHook, args));
      }
    }

    // can be set by hooks or by computed columns
    if (hookSelect || tempReturnType !== returnType) {
      if (renames) {
        for (const record of result as RecordUnknown[]) {
          for (const a in renames) {
            record[a] = record[renames[a]];
          }
        }
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
      result = applyTransforms(returnType, query.transform, result);
    }

    return resolve?.(result);
  } catch (err) {
    let error;
    if (err instanceof pg.DatabaseError) {
      error = new (q.error as unknown as new () => QueryError)();
      assignError(error, err);
      error.cause = localError;
    } else {
      error = err;
      if (error instanceof Error) {
        error.cause = localError;
      }
    }

    if (log && sql) {
      log.onError(error as Error, sql as SingleSqlItem, logData);
    }
    return reject?.(error);
  }
};

const assignError = (to: QueryError, from: pg.DatabaseError) => {
  to.message = from.message;
  (to as { length?: number }).length = from.length;
  (to as { name?: string }).name = from.name;
  to.severity = from.severity;
  to.code = from.code;
  to.detail = from.detail;
  to.hint = from.hint;
  to.position = from.position;
  to.internalPosition = from.internalPosition;
  to.internalQuery = from.internalQuery;
  to.where = from.where;
  to.schema = from.schema;
  to.table = from.table;
  to.column = from.column;
  to.dataType = from.dataType;
  to.constraint = from.constraint;
  to.file = from.file;
  to.line = from.line;
  to.routine = from.routine;

  return to;
};

export const handleResult: HandleResult = (
  q,
  returnType,
  result,
  isSubQuery,
) => {
  const { parsers } = q.q;

  switch (returnType) {
    case 'all': {
      if (q.q.throwOnNotFound && result.rows.length === 0)
        throw new NotFoundError(q);

      const promise = parseBatch(q, result);

      const { rows } = result;

      if (parsers) {
        for (const row of rows) {
          parseRecord(parsers, row);
        }
      }

      return promise ? promise.then(() => rows) : rows;
    }
    case 'one': {
      const { rows } = result;
      if (!rows.length) return;

      const promise = parseBatch(q, result);

      if (parsers) parseRecord(parsers, rows[0]);

      return promise ? promise.then(() => rows[0]) : rows[0];
    }
    case 'oneOrThrow': {
      const { rows } = result;
      if (!rows.length) throw new NotFoundError(q);

      const promise = parseBatch(q, result);

      if (parsers) parseRecord(parsers, rows[0]);

      return promise ? promise.then(() => rows[0]) : rows[0];
    }
    case 'rows': {
      const { rows } = result;

      const promise = parseBatch(q, result);
      if (promise) {
        return promise.then(() => {
          if (parsers) parseRows(parsers, result.fields, rows);

          return rows;
        });
      } else if (parsers) {
        parseRows(parsers, result.fields, rows);
      }

      return rows;
    }
    case 'pluck': {
      const { rows } = result;

      const promise = parseBatch(q, result);

      if (promise) {
        return promise.then(() => {
          parsePluck(parsers, isSubQuery, rows);

          return rows;
        });
      }

      parsePluck(parsers, isSubQuery, rows);

      return rows;
    }
    case 'value': {
      const { rows } = result;

      const promise = parseBatch(q, result);

      if (promise) {
        return promise.then(() => {
          return rows[0]?.[0] !== undefined
            ? parseValue(rows[0][0], parsers)
            : q.q.notFoundDefault;
        });
      }

      return rows[0]?.[0] !== undefined
        ? parseValue(rows[0][0], parsers)
        : q.q.notFoundDefault;
    }
    case 'valueOrThrow': {
      const { rows } = result;

      const promise = parseBatch(q, result);

      if (promise) {
        return promise.then(() => {
          if (rows[0]?.[0] === undefined) throw new NotFoundError(q);
          return parseValue(rows[0][0], parsers);
        });
      }

      if (rows[0]?.[0] === undefined) throw new NotFoundError(q);
      return parseValue(rows[0][0], parsers);
    }
    case 'rowCount': {
      if (q.q.throwOnNotFound && result.rowCount === 0) {
        throw new NotFoundError(q);
      }
      return result.rowCount;
    }
    case 'void': {
      return;
    }
  }
};

const parseBatch = (q: Query, queryResult: QueryResult): MaybePromise<void> => {
  let promises: Promise<void>[] | undefined;

  if (q.q.batchParsers) {
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
    const row = (result as RecordUnknown[])[0];
    if (!row) throw new NotFoundError(q);

    return row[getFirstResultKey(q, queryResult) as string];
  }

  if (returnType === 'rowCount') {
    return queryResult.rowCount;
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
