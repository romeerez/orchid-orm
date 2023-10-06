import { Query, SetQueryReturnsColumn } from '../query/query';
import {
  ColumnTypeBase,
  emptyObject,
  Expression,
  getValueKey,
  setParserToQuery,
  toArray,
} from 'orchid-core';
import { SelectableOrExpression } from './utils';
import { OrderItem, SelectQueryData, ToSQLCtx, WhereItem } from '../sql';
import { addValue, columnToSql, rawOrColumnToSql } from '../sql/common';
import { pushOrderBySql } from '../sql/orderBy';
import { whereToSql } from '../sql/where';
import { windowToSql } from '../sql/window';
import { OrderArg, WhereArg, WindowArgDeclaration } from '../queryMethods';
import { BooleanNullable } from '../columns';
import { BaseOperators, setQueryOperators } from '../columns/operators';

// Additional SQL options that can be accepted by any aggregate function.
export type AggregateOptions<T extends Query> = {
  // Add DISTINCT inside of function call.
  distinct?: boolean;
  // The same argument as in .order() to be set inside of function call.
  order?: OrderArg<T> | OrderArg<T>[];
  // The same argument as in .where() to be set inside of function call.
  filter?: WhereArg<T>;
  // The same argument as in .orWhere() to support OR logic of the filter clause.
  filterOr?: WhereArg<T>[];
  // Adds WITHIN GROUP SQL statement.
  withinGroup?: boolean;
  // defines OVER clause.
  // Can be the name of a window defined by calling the .window() method,
  // or object the same as the .window() method takes to define a window.
  over?: Over<T>;
};

// Window definition or name.
export type Over<T extends Query> =
  | keyof T['windows']
  | WindowArgDeclaration<T>;

// Arguments of function.
// It can be a column name, expression,
// `pairs` is for { key: value } which is translated to ('key', value) (used by `jsonObjectAgg`),
// `value` is for a query variable (used by `stringAgg` for a delimiter).
export type FnExpressionArgs<Q extends Query> = (
  | SelectableOrExpression<Q>
  | { pairs: Record<string, SelectableOrExpression<Q>> }
  | { value: unknown }
)[];

// Expression for SQL function calls.
export class FnExpression<
  Q extends Query = Query,
  T extends ColumnTypeBase = ColumnTypeBase,
> extends Expression<T> {
  /**
   * @param q - query object.
   * @param fn - SQL function name.
   * @param args - arguments of the function.
   * @param options - aggregate options.
   * @param _type - column type of the function result.
   */
  constructor(
    public q: Q,
    public fn: string,
    public args: FnExpressionArgs<Q>,
    public options: AggregateOptions<Q> = emptyObject,
    public _type: T,
  ) {
    super();
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
              : columnToSql(ctx, this.q.q, this.q.q.shape, arg, quotedAs, true);
          } else if (arg instanceof Expression) {
            return arg.toSQL(ctx, quotedAs);
          } else if ('pairs' in arg) {
            const args: string[] = [];
            const { pairs } = arg;
            for (const key in pairs) {
              args.push(
                // ::text is needed to bypass "could not determine data type of parameter" postgres error
                `${addValue(values, key)}::text, ${rawOrColumnToSql(
                  ctx,
                  this.q.q,
                  pairs[
                    key as keyof typeof pairs
                  ] as unknown as SelectableOrExpression,
                  quotedAs,
                )}`,
              );
            }
            return args.join(', ');
          } else {
            return addValue(values, arg.value);
          }
        })
        .join(', '),
    );

    if (options.withinGroup) sql.push(') WITHIN GROUP (');
    else if (options.order) sql.push(' ');

    if (options.order) {
      pushOrderBySql(
        { ...ctx, sql },
        this.q.q,
        quotedAs,
        toArray(options.order) as OrderItem[],
      );
    }

    sql.push(')');

    if (options.filter || options.filterOr) {
      const whereSql = whereToSql(
        ctx,
        this.q,
        {
          and: options.filter ? ([options.filter] as WhereItem[]) : undefined,
          or: options.filterOr?.map((item) => [item]) as WhereItem[][],
          shape: this.q.q.shape,
          joinedShapes: this.q.q.joinedShapes,
        },
        quotedAs,
      );
      if (whereSql) {
        sql.push(` FILTER (WHERE ${whereSql})`);
      }
    }

    if (options.over) {
      sql.push(
        ` OVER ${windowToSql(ctx, this.q.q, options.over as string, quotedAs)}`,
      );
    }

    return sql.join('');
  }
}

// Adds column operator functions to the expression.
export type ColumnExpression<
  C extends ColumnTypeBase,
  Ops extends BaseOperators = C['operators'],
> = Expression<C> & {
  [K in keyof Ops]: (
    arg: Ops[K]['_opType'],
  ) => ColumnExpression<BooleanNullable>;
};

// Applies Expression to the query.
// The query returns a column of Expression type, and has column operators of this type.
export const makeExpression = <T extends Query, C extends ColumnTypeBase>(
  self: T,
  expr: Expression,
): SetQueryReturnsColumn<T, C> & C['operators'] => {
  const { _type: type } = expr;
  const q = setQueryOperators(self, type.operators);

  // Throw happens only on `undefined`, which is not the case for `sum` and other functions that can return `null`.
  q.q.returnType = 'valueOrThrow';
  (q.q as SelectQueryData).returnsOne = true;
  (q.q as SelectQueryData)[getValueKey] = type;
  q.q.expr = expr;
  q.q.select = [expr];

  if (type.parseFn) {
    setParserToQuery(q.q, getValueKey, type.parseFn);
  }

  return q as SetQueryReturnsColumn<T, C> & C['operators'];
};

// Applies a function expression to the query.
export function makeFnExpression<T extends Query, C extends ColumnTypeBase>(
  self: T,
  type: C,
  fn: string,
  args: FnExpressionArgs<Query>,
  options?: AggregateOptions<T>,
): SetQueryReturnsColumn<T, C> & C['operators'] {
  return makeExpression(
    self.clone(),
    new FnExpression<Query, ColumnTypeBase>(
      self,
      fn,
      args,
      options as AggregateOptions<Query> | undefined,
      type,
    ),
  ) as SetQueryReturnsColumn<T, C> & C['operators'];
}