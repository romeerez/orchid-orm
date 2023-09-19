import { Query, SetQueryReturnsColumn } from '../query/query';
import { ToSQLCtx } from '../sql';
import { addValue } from '../sql/common';
import {
  ColumnTypeBase,
  Expression,
  getValueKey,
  isExpression,
  OperatorToSQL,
} from 'orchid-core';
import { BooleanColumn } from './boolean';
import { extendQuery } from '../query/queryUtils';

// Operator function type.
// Table.count().gt(10) <- here `.gt(10)` is this operator function.
// It discards previously defined column type operators and applies new ones,
// for a case when operator gives a different column type.
export type Operator<Value, Column extends ColumnTypeBase = ColumnTypeBase> = {
  <T extends Query>(this: T, arg: Value): Omit<
    SetQueryReturnsColumn<T, Column>,
    keyof T['result']['value']['operators']
  > &
    Column['operators'];
  // argument type of the function
  _opType: Value;
  // function to turn the operator expression into SQL
  _op: OperatorToSQL<Value, ToSQLCtx>;
};

// any column has 'operators' record that implements this type
export type BaseOperators = Record<string, Operator<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Extend query object with given operator methods, so that user can call `gt` after calling `count`.
// If query already has the same operators, nothing is changed.
// Previously defined operators, if any, are dropped form the query.
// Adds new operators, saves `Query.baseQuery` into `QueryData.originalQuery`, saves operators to `QueryData.operators`.
export function setQueryOperators(q: Query, operators: BaseOperators) {
  if (q.q.operators) {
    if (q.q.operators === operators) return q;

    q.baseQuery = q.q.originalQuery as Query;
  } else {
    q.q.originalQuery = q.baseQuery;
  }

  q.q.operators = operators;
  return extendQuery(q, operators);
}

/**
 * Makes operator function that has `_op` property.
 *
 * @param _op - function to turn the operator call into SQL.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const make = <Value = any>(
  _op: (key: string, value: Value, ctx: ToSQLCtx, quotedAs?: string) => string,
): Operator<Value> => {
  return Object.assign(
    function (this: Query, value: Value) {
      const expr = this.q.expr as Expression;
      (expr._chain ??= []).push(_op, value);

      // parser might be set by a previous type, but is not needed for boolean
      if (this.q.parsers?.[getValueKey]) {
        this.q.parsers[getValueKey] = undefined;
      }

      return setQueryOperators(this, boolean);
    },
    {
      _op,
    },
  ) as unknown as Operator<Value>;
};

// Handles array, expression object, query object to insert into sql.
// Saves values to `ctx.values`.
const quoteValue = (
  arg: unknown,
  ctx: ToSQLCtx,
  quotedAs: string | undefined,
  jsonArray?: boolean,
): string => {
  if (arg && typeof arg === 'object') {
    if (!jsonArray && Array.isArray(arg)) {
      return `(${arg.map((value) => addValue(ctx.values, value)).join(', ')})`;
    }

    if (isExpression(arg)) {
      return arg.toSQL(ctx, quotedAs);
    }

    if ('toSQL' in arg) {
      return `(${(arg as Query).toSQL({ values: ctx.values }).text})`;
    }
  }

  return addValue(ctx.values, arg);
};

// common operators that exist for any types
type Base<Value> = {
  equals: Operator<Value | Query | Expression, BooleanColumn>;
  not: Operator<Value | Query | Expression, BooleanColumn>;
  in: Operator<Value[] | Query | Expression, BooleanColumn>;
  notIn: Operator<Value[] | Query | Expression, BooleanColumn>;
};

const base = {
  equals: make((key, value, ctx, quotedAs) =>
    value === null
      ? `${key} IS NULL`
      : `${key} = ${quoteValue(value, ctx, quotedAs)}`,
  ),
  not: make((key, value, ctx, quotedAs) =>
    value === null
      ? `${key} IS NOT NULL`
      : `${key} <> ${quoteValue(value, ctx, quotedAs)}`,
  ),
  in: make(
    (key, value, ctx, quotedAs) =>
      `${key} IN ${quoteValue(value, ctx, quotedAs)}`,
  ),
  notIn: make(
    (key, value, ctx, quotedAs) =>
      `NOT ${key} IN ${quoteValue(value, ctx, quotedAs)}`,
  ),
} as Base<unknown>;

// Boolean type operators
type Bool = Base<boolean> & {
  and: Operator<
    SetQueryReturnsColumn<Query, BooleanColumn> & BooleanColumn['operators'],
    BooleanColumn
  >;
  or: Operator<
    SetQueryReturnsColumn<Query, BooleanColumn> & BooleanColumn['operators'],
    BooleanColumn
  >;
};

const boolean = {
  ...base,
  and: make(
    (key, value, ctx, quotedAs) =>
      `${key} AND ${value.q.expr.toSQL(ctx, quotedAs)}`,
  ),
  or: make(
    (key, value, ctx, quotedAs) =>
      `(${key}) OR (${value.q.expr.toSQL(ctx, quotedAs)})`,
  ),
} as unknown as Bool;

// Numeric, date, and time can be compared with `lt`, `gt`, so it's generic.
type Ord<Value> = Base<Value> & {
  lt: Operator<Value | Query | Expression, BooleanColumn>;
  lte: Operator<Value | Query | Expression, BooleanColumn>;
  gt: Operator<Value | Query | Expression, BooleanColumn>;
  gte: Operator<Value | Query | Expression, BooleanColumn>;
  between: Operator<
    [Value | Query | Expression, Value | Query | Expression],
    BooleanColumn
  >;
};

type Numeric = Ord<number>;

const numeric = {
  ...base,
  lt: make(
    (key, value, ctx, quotedAs) =>
      `${key} < ${quoteValue(value, ctx, quotedAs)}`,
  ),
  lte: make(
    (key, value, ctx, quotedAs) =>
      `${key} <= ${quoteValue(value, ctx, quotedAs)}`,
  ),
  gt: make(
    (key, value, ctx, quotedAs) =>
      `${key} > ${quoteValue(value, ctx, quotedAs)}`,
  ),
  gte: make(
    (key, value, ctx, quotedAs) =>
      `${key} >= ${quoteValue(value, ctx, quotedAs)}`,
  ),
  between: make<[unknown, unknown]>(
    (key, [from, to], ctx, quotedAs) =>
      `${key} BETWEEN ${quoteValue(from, ctx, quotedAs)} AND ${quoteValue(
        to,
        ctx,
        quotedAs,
      )}`,
  ),
} as Numeric;

// Text type operators
type Text = Base<string> & {
  contains: Operator<string | Query | Expression, BooleanColumn>;
  containsSensitive: Operator<string | Query | Expression, BooleanColumn>;
  startsWith: Operator<string | Query | Expression, BooleanColumn>;
  startsWithSensitive: Operator<string | Query | Expression, BooleanColumn>;
  endsWith: Operator<string | Query | Expression, BooleanColumn>;
  endsWithSensitive: Operator<string | Query | Expression, BooleanColumn>;
};

const text = {
  ...base,
  contains: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE '%' || ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  containsSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE '%' || ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  startsWith: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  startsWithSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE ${quoteValue(value, ctx, quotedAs)} || '%'`,
  ),
  endsWith: make(
    (key, value, ctx, quotedAs) =>
      `${key} ILIKE '%' || ${quoteValue(value, ctx, quotedAs)}`,
  ),
  endsWithSensitive: make(
    (key, value, ctx, quotedAs) =>
      `${key} LIKE '%' || ${quoteValue(value, ctx, quotedAs)}`,
  ),
} as Text;

// JSON type operators
type Json = Base<unknown> & {
  jsonPath: Operator<
    [path: string, op: string, value: unknown | Query | Expression],
    BooleanColumn
  >;
  jsonSupersetOf: Operator<unknown | Query | Expression, BooleanColumn>;
  jsonSubsetOf: Operator<unknown | Query | Expression, BooleanColumn>;
};

const json = {
  ...base,
  jsonPath: make<[string, string, unknown]>(
    (key, [path, op, value], ctx, quotedAs) =>
      `jsonb_path_query_first(${key}, '${path}') #>> '{}' ${op} ${quoteValue(
        value,
        ctx,
        quotedAs,
        true,
      )}`,
  ),
  jsonSupersetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} @> ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
  jsonSubsetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} <@ ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
} as Json;

// `Operators` has operators grouped by types. To be used by column classes.
export const Operators = {
  any: base,
  boolean,
  number: numeric,
  date: numeric,
  time: numeric,
  text,
  json,
  array: base,
} as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any: Base<any>;
  boolean: Bool;
  number: Numeric;
  date: Ord<Date | string>;
  time: Numeric;
  text: Text;
  json: Json;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: Base<any>;
};
