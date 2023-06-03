import { Query, QueryReturnType } from '../query';
import { NotFoundError, QueryError } from '../errors';
import { QueryArraysResult, QueryResult } from '../adapter';
import { CommonQueryData } from '../sql';
import { AfterHook, BeforeHook } from './hooks';
import pg from 'pg';
import {
  AdapterBase,
  ColumnParser,
  ColumnsParsers,
  getValueKey,
  Sql,
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
  result: QueryResult,
  isSubQuery?: true,
) => {
  return parseResult(
    q,
    q.query.parsers,
    q.query.returnType || 'all',
    result,
    isSubQuery,
  );
};

function maybeWrappedThen(this: Query, resolve?: Resolve, reject?: Reject) {
  const adapter = this.internal.transactionStorage.getStore();
  if (this.query.wrapInTransaction && !adapter) {
    return this.transaction(
      () =>
        new Promise((resolve, reject) => {
          const adapter =
            this.internal.transactionStorage.getStore() as AdapterBase;
          return then(this, adapter, resolve, reject);
        }),
    ).then(resolve, reject);
  } else {
    return then(this, adapter || this.query.adapter, resolve, reject);
  }
}

const queriesNames: Record<string, string> = {};
let nameI = 0;

const then = async (
  q: Query,
  adapter: AdapterBase,
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
    let beforeHooks: BeforeHook[] | undefined;
    let afterHooks: AfterHook[] | undefined;
    if (query.type === 'insert') {
      beforeHooks = query.beforeCreate;
      afterHooks = query.afterCreate;
    } else if (query.type === 'update') {
      beforeHooks = query.beforeUpdate;
      afterHooks = query.afterUpdate;
    } else if (query.type === 'delete') {
      beforeHooks = query.beforeDelete;
      afterHooks = query.afterDelete;
    }

    if (beforeHooks || query.beforeQuery) {
      await Promise.all(
        getHooks(beforeHooks, query.beforeQuery).map((cb) => cb(q)),
      );
    }

    sql = q.toSql();

    if (query.autoPreparedStatements) {
      sql.name =
        queriesNames[sql.text] ||
        (queriesNames[sql.text] = (nameI++).toString(36));
    }

    if (query.log) {
      logData = query.log.beforeQuery(sql);
    }

    const queryResult = (await adapter[
      queryMethodByReturnType[query.returnType || 'all'] as 'query'
    ](sql)) as QueryResult;

    if (query.patchResult) {
      await query.patchResult(queryResult);
    }

    if (query.log) {
      query.log.afterQuery(sql, logData);
      // set sql to be undefined to prevent logging on error in case if afterHooks throws
      sql = undefined;
    }

    let result = query.handleResult(q, queryResult);

    if (afterHooks || query.afterQuery) {
      await Promise.all(
        getHooks(query.afterQuery, afterHooks).map((query) => query(q, result)),
      );
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

const getHooks = <T extends BeforeHook[] | AfterHook[]>(
  first?: T,
  second?: T,
): T => {
  return (
    first && second ? [...first, ...second] : first ? first : second
  ) as T;
};
