import {
  PickQueryMetaResultRelationsWindows,
  Query,
  SetQueryReturnsColumnOrThrow,
} from '../query/query';
import {
  addValue,
  ColumnTypeBase,
  emptyObject,
  Expression,
  ExpressionTypeMethod,
  getValueKey,
  PickQueryMeta,
  PickQueryMetaResultWindows,
  QueryColumn,
  setParserToQuery,
  toArray,
} from 'orchid-core';
import { SelectableOrExpression } from './utils';
import {
  OrderItem,
  QueryData,
  SelectQueryData,
  ToSQLCtx,
  WhereItem,
} from '../sql';
import { columnToSql, rawOrColumnToSql } from '../sql/common';
import { pushOrderBySql } from '../sql/orderBy';
import { whereToSql } from '../sql/where';
import { windowToSql } from '../sql/window';
import {
  OrderArg,
  OrderArgs,
  WhereArg,
  WhereArgs,
  WindowArgDeclaration,
} from '../queryMethods';
import { extendQuery } from '../query/queryUtils';

// Additional SQL options that can be accepted by any aggregate function.
export interface AggregateOptions<
  T extends PickQueryMetaResultRelationsWindows,
> {
  // Add DISTINCT inside of function call.
  distinct?: boolean;
  // The same argument as in .order() to be set inside of function call.
  order?: OrderArg<T> | OrderArgs<T>;
  // The same argument as in .where() to be set inside of function call.
  filter?: WhereArg<T>;
  // The same argument as in .orWhere() to support OR logic of the filter clause.
  filterOr?: WhereArgs<T>;
  // Adds WITHIN GROUP SQL statement.
  withinGroup?: boolean;
  // defines OVER clause.
  // Can be the name of a window defined by calling the .window() method,
  // or object the same as the .window() method takes to define a window.
  over?: Over<T>;
}

// Window definition or name.
export type Over<T extends PickQueryMetaResultWindows> =
  | keyof T['windows']
  | WindowArgDeclaration<T>;

// Arguments of function.
// It can be a column name, expression,
// `pairs` is for { key: value } which is translated to ('key', value) (used by `jsonObjectAgg`),
// `value` is for a query variable (used by `stringAgg` for a delimiter).
export type FnExpressionArgs<Q extends PickQueryMeta> = (
  | SelectableOrExpression<Q>
  | FnExpressionArgsPairs<Q>
  | FnExpressionArgsValue
)[];

export interface FnExpressionArgsPairs<Q extends PickQueryMeta> {
  pairs: { [K: string]: SelectableOrExpression<Q> };
}

export interface FnExpressionArgsValue {
  value: unknown;
}

// Expression for SQL function calls.
export class FnExpression<
  Q extends Query = Query,
  T extends QueryColumn = QueryColumn,
> extends Expression<T> {
  result: { value: T };
  q: QueryData;

  /**
   * @param query - query object.
   * @param fn - SQL function name.
   * @param args - arguments of the function.
   * @param options - aggregate options.
   * @param value - column type of the function result.
   */
  constructor(
    public query: Q,
    public fn: string,
    public args: FnExpressionArgs<Q>,
    public options: AggregateOptions<Q> = emptyObject,
    value: T,
  ) {
    super();
    this.result = { value };
    (this.q = query.q).expr = this;
    Object.assign(query, value.operators);

    // Throw happens only on `undefined`, which is not the case for `sum` and other functions that can return `null`.
    query.q.returnType = 'valueOrThrow';
    (query.q as SelectQueryData).returnsOne = true;
    (query.q as SelectQueryData)[getValueKey] = value;
    query.q.select = [this];

    const { parseFn } = value as never as ColumnTypeBase;
    if (parseFn) {
      setParserToQuery(query.q, getValueKey, parseFn);
    }
  }

  // Builds function SQL.
  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    const sql: string[] = [`${this.fn}(`];

    const { values } = ctx;
    const { options } = this;

    if (options.distinct && !options.withinGroup) sql.push('DISTINCT ');

    sql.push(
      this.args
        .map((arg) => {
          if (typeof arg === 'string') {
            return arg === '*'
              ? '*'
              : columnToSql(ctx, this.q, this.q.shape, arg, quotedAs);
          } else if (arg instanceof Expression) {
            return arg.toSQL(ctx, quotedAs);
          } else if ('pairs' in (arg as FnExpressionArgsPairs<Query>)) {
            const args: string[] = [];
            const { pairs } = arg as FnExpressionArgsPairs<Query>;
            for (const key in pairs) {
              args.push(
                // ::text is needed to bypass "could not determine data type of parameter" postgres error
                `${addValue(values, key)}::text, ${rawOrColumnToSql(
                  ctx,
                  this.q,
                  pairs[key as keyof typeof pairs] as never,
                  quotedAs,
                )}`,
              );
            }
            return args.join(', ');
          } else {
            return addValue(values, (arg as FnExpressionArgsValue).value);
          }
        })
        .join(', '),
    );

    if (options.withinGroup) sql.push(') WITHIN GROUP (');
    else if (options.order) sql.push(' ');

    if (options.order) {
      pushOrderBySql(
        { ...ctx, sql },
        this.q,
        quotedAs,
        toArray(options.order) as OrderItem[],
      );
    }

    sql.push(')');

    if (options.filter || options.filterOr) {
      const whereSql = whereToSql(
        ctx,
        this.query,
        {
          and: options.filter ? ([options.filter] as WhereItem[]) : undefined,
          or: options.filterOr?.map((item) => [item]) as WhereItem[][],
          shape: this.q.shape,
          joinedShapes: this.q.joinedShapes,
        },
        quotedAs,
      );
      if (whereSql) {
        sql.push(` FILTER (WHERE ${whereSql})`);
      }
    }

    if (options.over) {
      sql.push(
        ` OVER ${windowToSql(ctx, this.q, options.over as string, quotedAs)}`,
      );
    }

    return sql.join('');
  }
}

// Applies a function expression to the query.
export function makeFnExpression<
  T extends PickQueryMetaResultRelationsWindows,
  C extends QueryColumn,
>(
  self: T,
  type: C,
  fn: string,
  args: FnExpressionArgs<Query>,
  options?: AggregateOptions<T>,
): SetQueryReturnsColumnOrThrow<T, C> & C['operators'] {
  const q = extendQuery(self as unknown as Query, type.operators);
  (q.baseQuery as unknown as ExpressionTypeMethod).type =
    ExpressionTypeMethod.prototype.type;

  new FnExpression<Query, QueryColumn>(
    q,
    fn,
    args,
    options as AggregateOptions<Query> | undefined,
    type,
  );

  return q as never;
}
