import { Query, QueryReturnType } from '../query';
import { NotFoundError, QueryError } from '../errors';
import { QueryArraysResult, QueryResult } from '../adapter';
import {
  CommonQueryData,
  QueryAfterHook,
  QueryBeforeHook,
  QueryHookSelect,
} from '../sql';
import pg from 'pg';
import {
  AdapterBase,
  callWithThis,
  ColumnParser,
  ColumnsParsers,
  emptyArray,
  getValueKey,
  Sql,
  TransactionState,
} from 'orchid-core';

export const queryMethodByReturnType: Record<
  QueryReturnType,
  'query' | 'arrays'
> = {
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

let queryError: Error = undefined as unknown as Error;

export class Then {
  get then() {
    queryError = new Error();
    return maybeWrappedThen;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(this: Query, fn: (reason: any) => unknown) {
    return this.then(undefined, fn);
  }
}

export const handleResult: CommonQueryData['handleResult'] = (
  q,
  returnType,
  result: QueryResult,
  isSubQuery?: true,
) => {
  return parseResult(q, q.query.parsers, returnType, result, isSubQuery);
};

function maybeWrappedThen(this: Query, resolve?: Resolve, reject?: Reject) {
  const { query } = this;

  let beforeHooks: QueryBeforeHook[] | undefined;
  let afterHooks: QueryAfterHook[] | undefined;
  let afterCommitHooks: QueryAfterHook[] | undefined;
  if (query.type) {
    if (query.type === 'insert') {
      beforeHooks = query.beforeCreate;
      afterHooks = query.afterCreate;
      afterCommitHooks = query.afterCreateCommit;
    } else if (query.type === 'update') {
      beforeHooks = query.beforeUpdate;
      afterHooks = query.afterUpdate;
      afterCommitHooks = query.afterUpdateCommit;
    } else if (query.type === 'delete') {
      beforeHooks = query.beforeDelete;
      afterHooks = query.afterDelete;
      afterCommitHooks = query.afterDeleteCommit;
    }
  }

  const trx = this.internal.transactionStorage.getStore();
  if ((query.wrapInTransaction || afterHooks?.length) && !trx) {
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
      trx?.adapter || this.query.adapter,
      trx,
      beforeHooks,
      afterHooks,
      afterCommitHooks,
      resolve,
      reject,
    );
  }
}

const queriesNames: Record<string, string> = {};
let nameI = 0;

const callAfterHook = function (
  this: [result: unknown[], q: Query],
  cb: QueryAfterHook,
): Promise<unknown> | unknown {
  return cb(this[0], this[1]);
};

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
  const { query } = q;

  let sql: (Sql & { name?: string }) | undefined;
  let logData: unknown | undefined;

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

    sql = q.toSql();
    const { hookSelect } = sql;

    if (query.autoPreparedStatements) {
      sql.name =
        queriesNames[sql.text] ||
        (queriesNames[sql.text] = (nameI++).toString(36));
    }

    if (query.log) {
      logData = query.log.beforeQuery(sql);
    }

    const { returnType = 'all' } = query;
    const returns = hookSelect ? 'all' : returnType;

    const queryResult = (await adapter[
      hookSelect ? 'query' : (queryMethodByReturnType[returnType] as 'query')
    ](sql)) as QueryResult;

    if (query.patchResult) {
      await query.patchResult(q, queryResult);
    }

    if (query.log) {
      query.log.afterQuery(sql, logData);
      // set sql to be undefined to prevent logging on error in case if afterHooks throws
      sql = undefined;
    }

    let result = query.handleResult(q, returns, queryResult);

    if (afterHooks || afterCommitHooks || query.after) {
      if ((result as unknown[]).length) {
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

      if (hookSelect)
        result = filterResult(q, returnType, queryResult, hookSelect, result);
    }

    if (query.transform) {
      for (const fn of query.transform) {
        result = fn(result);
      }
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

    if (query.log && sql && logData) {
      query.log.onError(error as Error, sql, logData);
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

export const parseResult = (
  q: Query,
  parsers: ColumnsParsers | undefined,
  returnType: QueryReturnType | undefined = 'all',
  result: QueryResult,
  isSubQuery?: boolean,
): unknown => {
  switch (returnType) {
    case 'all': {
      if (q.query.throwOnNotFound && result.rows.length === 0)
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
      const row = result.rows[0];
      if (!row) return;

      return parsers ? parseRecord(parsers, row) : row;
    }
    case 'oneOrThrow': {
      const row = result.rows[0];
      if (!row) throw new NotFoundError(q);

      return parsers ? parseRecord(parsers, row) : row;
    }
    case 'rows': {
      return parsers
        ? parseRows(
            parsers,
            (result as unknown as QueryArraysResult).fields,
            result.rows,
          )
        : result.rows;
    }
    case 'pluck': {
      const pluck = parsers?.pluck;
      if (pluck) {
        return result.rows.map(isSubQuery ? pluck : (row) => pluck(row[0]));
      } else if (isSubQuery) {
        return result.rows;
      }
      return result.rows.map((row) => row[0]);
    }
    case 'value': {
      const value = result.rows[0]?.[0];
      return value !== undefined
        ? parseValue(value, parsers)
        : q.query.notFoundDefault;
    }
    case 'valueOrThrow': {
      const value = result.rows[0]?.[0];
      if (value === undefined) throw new NotFoundError(q);
      return parseValue(value, parsers);
    }
    case 'rowCount': {
      if (q.query.throwOnNotFound && result.rowCount === 0) {
        throw new NotFoundError(q);
      }
      return result.rowCount;
    }
    case 'void': {
      return;
    }
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseRecord = (parsers: ColumnsParsers, row: any) => {
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
) => {
  for (let i = fields.length - 1; i >= 0; i--) {
    const parser = parsers[fields[i].name];
    if (parser) {
      for (const row of rows) {
        row[i] = parser(row[i]);
      }
    }
  }
  return rows;
};

const parseValue = (value: unknown, parsers?: ColumnsParsers) => {
  const parser = parsers?.[getValueKey];
  return parser ? parser(value) : value;
};

const filterResult = (
  q: Query,
  returnType: QueryReturnType,
  queryResult: QueryResult,
  hookSelect: QueryHookSelect,
  result: unknown,
): unknown => {
  if (returnType === 'all') {
    const pick = getSelectPick(queryResult, hookSelect);
    return (result as unknown[]).map((full) => {
      const filtered: Record<string, unknown> = {};
      for (const key of pick) {
        filtered[key] = (full as Record<string, unknown>)[key];
      }
      return filtered;
    });
  }

  if (returnType === 'oneOrThrow' || returnType === 'one') {
    const row = (result as unknown[])[0];
    if (!row) {
      if (returnType === 'oneOrThrow') throw new NotFoundError(q);
      return undefined;
    } else {
      result = {};
      for (const key in row) {
        if (!hookSelect.includes(key)) {
          (result as Record<string, unknown>)[key] = (
            row as Record<string, unknown>
          )[key];
        }
      }
      return result;
    }
  }

  if (returnType === 'value') {
    return (result as Record<string, unknown>[])[0]?.[
      queryResult.fields[0].name
    ];
  }

  if (returnType === 'valueOrThrow') {
    const row = (result as Record<string, unknown>[])[0];
    if (!row) throw new NotFoundError(q);
    return row[queryResult.fields[0].name];
  }

  if (returnType === 'rowCount') {
    return queryResult.rowCount;
  }

  if (returnType === 'pluck') {
    const key = queryResult.fields[0].name;
    return (result as Record<string, unknown>[]).map((row) => row[key]);
  }

  if (returnType === 'rows') {
    const pick = getSelectPick(queryResult, hookSelect);
    return (result as unknown[]).map((full) =>
      pick.map((key) => (full as Record<string, unknown>)[key]),
    );
  }

  return;
};

const getSelectPick = (
  queryResult: QueryResult,
  hookSelect: QueryHookSelect,
): string[] => {
  const pick: string[] = [];
  for (const field of queryResult.fields) {
    if (!hookSelect.includes(field.name)) pick.push(field.name);
  }
  return pick;
};
