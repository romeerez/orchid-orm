import { Expression, Query } from 'pqb';
import {
  Column,
  emptyObject,
  type ExpressionData,
  type QueryThen,
  type SingleSql,
  type Sql,
  type ToSqlValues,
} from 'pqb/internal';

type RequiredPreparedParams<Params extends object> = {
  [K in keyof Params]-?: Exclude<Params[K], undefined>;
};

export type PreparedQueryParams<Params extends object> = {
  [K in keyof Params]: Expression<Column.Pick.QueryColumnOfType<Params[K]>>;
};

type PreparedQueryResult<Q extends Query> =
  Q['then'] extends QueryThen<infer Result> ? Promise<Result> : never;

export type PreparedQueryExecutor<
  Params extends object,
  Q extends Query,
> = keyof Params extends never
  ? () => PreparedQueryResult<Q>
  : (params: Params) => PreparedQueryResult<Q>;

export interface OrmPrepareMethods {
  /**
   * Creates a query executor that builds SQL once on its first execution and
   * reuses it as a driver prepared statement afterwards.
   *
   * Values closed over by `callback` are static: they are captured when the
   * prepared query is defined. Use `Params` for values that change per call.
   */
  $prepare<Params extends object = {}, Q extends Query = Query>(
    callback: (params: PreparedQueryParams<Params>) => Q,
    ...invalidParams: Params extends RequiredPreparedParams<Params>
      ? []
      : [
          message: 'Prepared statement parameters must be required and cannot include undefined',
        ]
  ): PreparedQueryExecutor<Params, Q>;
}

class PreparedParamExpression<T> extends Expression<
  Column.Pick.QueryColumnOfType<T>
> {
  result = {
    value: emptyObject as Column.Pick.QueryColumnOfType<T>,
  };
  q: ExpressionData = { expr: this };

  constructor(readonly key: string) {
    super();
  }

  makeSQL(ctx: ToSqlValues): string {
    ctx.values.push(this);
    return `$${ctx.values.length}`;
  }
}

const prepareSqlItem = (
  sql: SingleSql,
  params: Record<string, unknown>,
): SingleSql => {
  const values = sql.values?.map((value) => {
    return value instanceof PreparedParamExpression ? params[value.key] : value;
  });

  return { ...sql, values, prepare: true };
};

const prepareSql = (sql: Sql, params: Record<string, unknown>): Sql => {
  if ('text' in sql) return prepareSqlItem(sql, params);

  return {
    ...sql,
    batch: sql.batch.map((item) => prepareSqlItem(item, params)),
  };
};

const createPreparedParams = <
  Params extends object,
>(): PreparedQueryParams<Params> => {
  const expressions = Object.create(null) as Record<
    string,
    PreparedParamExpression<unknown>
  >;

  const params = new Proxy(expressions, {
    get(expressions, key) {
      if (typeof key !== 'string') return;

      let expression = expressions[key];
      if (!expression) {
        expression = new PreparedParamExpression(key);
        expressions[key] = expression;
      }

      return expression;
    },
  });

  return params as unknown as PreparedQueryParams<Params>;
};

export const ormPrepare = (): OrmPrepareMethods['$prepare'] => {
  return ((callback) => {
    const query = callback(createPreparedParams());
    const emptyParams: Record<string, unknown> = {};
    let prepared: { query: Query; sql: Sql } | undefined;

    return (params?: Record<string, unknown>) => {
      let cached: { query: Query; sql: Sql };
      if (prepared) {
        cached = prepared;
      } else {
        const sql = query.toSQL(true);
        cached = {
          query: Object.create(query) as Query,
          sql,
        };
        prepared = cached;
      }

      const executionQuery = Object.create(cached.query) as Query;
      Object.defineProperty(executionQuery, 'toSQL', {
        value: () => prepareSql(cached.sql, params ?? emptyParams),
      });
      return executionQuery.then();
    };
  }) as OrmPrepareMethods['$prepare'];
};
