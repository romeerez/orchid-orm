import { ColumnsParsers, Query, QueryReturnType } from '../query';
import { NotFoundError, QueryError } from '../errors';
import { QueryArraysResult, QueryResult } from '../adapter';
import { CommonQueryData, Sql } from '../sql';
import { AfterCallback, BeforeCallback } from './callbacks';
import { getValueKey } from './get';
import pg from 'pg';
import { getQueryParsers } from '../utils';

export type ThenResult<Res> = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (value: Res) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
) => Promise<Res | never>;

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

  async catch<T extends Query, Result>(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (reason: any) => Result | PromiseLike<Result>,
  ): Promise<ReturnType<T['then']> | Result> {
    return this.then(undefined, fn);
  }
}

export const handleResult: CommonQueryData['handleResult'] = async (
  q,
  result: QueryResult,
) => {
  return parseResult(q, q.query.returnType || 'all', result);
};

function maybeWrappedThen(this: Query, resolve?: Resolve, reject?: Reject) {
  if (this.query.wrapInTransaction && !this.query.inTransaction) {
    return this.transaction(
      (q) => new Promise((resolve, reject) => then(q, resolve, reject)),
    ).then(resolve, reject);
  } else {
    return then(this, resolve, reject);
  }
}

const queriesNames: Record<string, string> = {};
let nameI = 0;

const then = async (
  q: Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve?: (result: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject?: (error: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  let sql: (Sql & { name?: string }) | undefined;
  let logData: unknown | undefined;

  // save error to a local variable before async operations
  const localError = queryError;

  try {
    let beforeCallbacks: BeforeCallback[] | undefined;
    let afterCallbacks: AfterCallback[] | undefined;
    if (q.query.type === 'insert') {
      beforeCallbacks = q.query.beforeCreate;
      afterCallbacks = q.query.afterCreate;
    } else if (q.query.type === 'update') {
      beforeCallbacks = q.query.beforeUpdate;
      afterCallbacks = q.query.afterUpdate;
    } else if (q.query.type === 'delete') {
      beforeCallbacks = q.query.beforeDelete;
      afterCallbacks = q.query.afterDelete;
    }

    if (beforeCallbacks || q.query.beforeQuery) {
      await Promise.all(
        getCallbacks(beforeCallbacks, q.query.beforeQuery).map((cb) => cb(q)),
      );
    }

    sql = q.toSql();

    if (q.query.autoPreparedStatements) {
      sql.name =
        queriesNames[sql.text] ||
        (queriesNames[sql.text] = (nameI++).toString(36));
    }

    if (q.query.log) {
      logData = q.query.log.beforeQuery(sql);
    }

    const queryResult = await q.query.adapter[
      queryMethodByReturnType[q.query.returnType || 'all'] as 'query'
    ](sql);

    if (q.query.log) {
      q.query.log.afterQuery(sql, logData);
      // set sql to be undefined to prevent logging on error in case if afterCallbacks throws
      sql = undefined;
    }

    const result = await q.query.handleResult(q, queryResult);

    if (afterCallbacks || q.query.afterQuery) {
      await Promise.all(
        getCallbacks(q.query.afterQuery, afterCallbacks).map((query) =>
          query(q, result),
        ),
      );
    }

    resolve?.(result);
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

    if (q.query.log && sql && logData) {
      q.query.log.onError(error as Error, sql, logData);
    }
    reject?.(error);
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
  returnType: QueryReturnType | undefined = 'all',
  result: QueryResult,
): unknown => {
  switch (returnType) {
    case 'all': {
      if (q.query.throwOnNotFound && result.rows.length === 0)
        throw new NotFoundError();

      const parsers = getQueryParsers(q);
      return parsers
        ? result.rows.map((row) => parseRecord(parsers, row))
        : result.rows;
    }
    case 'one': {
      const row = result.rows[0];
      if (!row) return;

      const parsers = getQueryParsers(q);
      return parsers ? parseRecord(parsers, row) : row;
    }
    case 'oneOrThrow': {
      const row = result.rows[0];
      if (!row) throw new NotFoundError();

      const parsers = getQueryParsers(q);
      return parsers ? parseRecord(parsers, row) : row;
    }
    case 'rows': {
      const parsers = getQueryParsers(q);
      return parsers
        ? parseRows(
            parsers,
            (result as unknown as QueryArraysResult).fields,
            result.rows,
          )
        : result.rows;
    }
    case 'pluck': {
      const parsers = getQueryParsers(q);
      if (parsers?.pluck) {
        return result.rows.map((row) => parsers.pluck(row[0]));
      }
      return result.rows.map((row) => row[0]);
    }
    case 'value': {
      const value = result.rows[0]?.[0];
      return value !== undefined
        ? parseValue(value, q)
        : q.query.notFoundDefault;
    }
    case 'valueOrThrow': {
      const value = result.rows[0]?.[0];
      if (value === undefined) throw new NotFoundError();
      return parseValue(value, q);
    }
    case 'rowCount': {
      if (q.query.throwOnNotFound && result.rowCount === 0) {
        throw new NotFoundError();
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
    if (row[key] !== null && row[key] !== undefined) {
      row[key] = parsers[key](row[key]);
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
  fields.forEach((field, i) => {
    const parser = parsers[field.name];
    if (parser) {
      rows.forEach((row) => {
        row[i] = parser(row[i]);
      });
    }
  });
  return rows;
};

const parseValue = (value: unknown, query: Query) => {
  if (value !== null) {
    const parsers = getQueryParsers(query);
    const parser = parsers?.[getValueKey];
    if (parser) {
      return parser(value);
    }
  }
  return value;
};

const getCallbacks = <T extends BeforeCallback[] | AfterCallback[]>(
  first?: T,
  second?: T,
): T => {
  return (
    first && second ? [...first, ...second] : first ? first : second
  ) as T;
};
