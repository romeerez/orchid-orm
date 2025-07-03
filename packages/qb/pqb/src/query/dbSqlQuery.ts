import {
  isRawSQL,
  QueryResultRow,
  RecordUnknown,
  Sql,
  SQLQueryArgs,
  TemplateLiteralArgs,
} from 'orchid-core';
import {
  Adapter,
  QueryBuilder,
  QueryData,
  QueryInternal,
  QueryResult,
  templateLiteralToSQL,
} from 'pqb';

export interface DbSqlQuery {
  <T extends QueryResultRow = QueryResultRow>(...args: SQLQueryArgs): Promise<
    QueryResult<T>
  >;

  /**
   * Returns an array of records:
   *
   * ```ts
   * const array: T[] = await db.$query.records<T>`SELECT * FROM table`;
   * ```
   */
  records<T extends RecordUnknown = RecordUnknown>(
    ...args: SQLQueryArgs
  ): Promise<T[]>;

  /**
   * Returns a single record, throws [NotFoundError](/guide/error-handling) if not found.
   *
   * ```ts
   * const one: T = await db.$query.take<T>`SELECT * FROM table LIMIT 1`;
   * ```
   */
  take<T extends RecordUnknown = RecordUnknown>(
    ...args: SQLQueryArgs
  ): Promise<T>;

  /**
   * Returns a single record or `undefined` when not found.
   *
   * ```ts
   * const maybeOne: T | undefined = await db.$query
   *   .takeOptional<T>`SELECT * FROM table LIMIT 1`;
   * ```
   */
  takeOptional<T extends RecordUnknown = RecordUnknown>(
    ...args: SQLQueryArgs
  ): Promise<T | undefined>;

  /**
   * Returns array of tuples of the values:
   *
   * ```ts
   * const arrayOfTuples: [number, string][] = await db.$query.rows<
   *   [number, string]
   * >`SELECT id, name FROM table`;
   * ```
   */
  rows<T extends unknown[]>(...args: SQLQueryArgs): Promise<T[]>;

  /**
   * Returns a flat array of values for a single column:
   *
   * ```ts
   * const strings: string[] = await db.$query.pluck<string>`SELECT name FROM table`;
   * ```
   */
  pluck<T>(...args: SQLQueryArgs): Promise<T[]>;

  /**
   * Returns a single value, throws [NotFoundError](/guide/error-handling) if not found.
   *
   * ```ts
   * const value: number = await db.$query.get<number>`SELECT 1`;
   * ```
   */
  get<T>(...args: SQLQueryArgs): Promise<T>;

  /**
   * Returns a single value or `undefined` when not found.
   *
   * ```ts
   * const value: number | undefined = await db.$query.getOptional<number>`SELECT 1`;
   * ```
   */
  getOptional<T>(...args: SQLQueryArgs): Promise<T | undefined>;
}

export const performQuery = async <Result = QueryResult>(
  q: {
    qb: QueryBuilder;
    internal: QueryInternal;
    adapter: Adapter;
    q: QueryData;
  },
  args: SQLQueryArgs,
  method: 'query' | 'arrays',
): Promise<Result> => {
  const trx = q.internal.transactionStorage.getStore();
  let sql: Sql;
  if (isRawSQL(args[0])) {
    const values: unknown[] = [];
    sql = {
      text: args[0].toSQL({ values }),
      values,
    };
  } else {
    const values: unknown[] = [];
    sql = {
      text: templateLiteralToSQL(args as TemplateLiteralArgs, {
        qb: q.qb,
        q: q.q,
        sql: [],
        values,
      }),
      values,
    };
  }

  const log = trx?.log ?? q.q.log;
  let logData: unknown | undefined;
  if (log) logData = log.beforeQuery(sql);

  try {
    const result = (await (trx?.adapter || q.adapter)[method as 'query'](
      sql,
    )) as Promise<Result>;

    if (log) log.afterQuery(sql, logData);

    return result;
  } catch (err) {
    if (log) {
      log.onError(err as Error, sql, logData);
    }

    throw err;
  }
};
