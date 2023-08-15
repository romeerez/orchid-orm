import { Query, SetQueryReturnsColumn } from '../query/query';
import { ToSQLCtx } from '../sql';
import { addValue } from '../sql/common';
import {
  ColumnTypeBase,
  Expression,
  isExpression,
  OperatorToSQL,
} from 'orchid-core';
import { FnExpression } from '../common/fn';
import { BooleanColumn } from './boolean';
import { extendQuery } from '../query/queryUtils';

export type Operator<Value, Column extends ColumnTypeBase = ColumnTypeBase> = {
  <T extends Query>(this: T, arg: Value): SetQueryReturnsColumn<T, Column> &
    Column['operators'];
  _opType: Value;
  _op: OperatorToSQL<Value, ToSQLCtx>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, Operator<any>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const make = <Value = any>(
  _op: (key: string, value: Value, ctx: ToSQLCtx, quotedAs?: string) => string,
): Operator<Value> => {
  return Object.assign(
    function (this: Query, value: Value) {
      const expr = this.q.expr as FnExpression;
      (expr._chain ??= []).push(_op, value);

      const q = extendQuery(this, boolean);
      // TODO: move isSubQuery into queryData
      q.isSubQuery = this.isSubQuery;
      return q;
    },
    {
      _op,
    },
  ) as unknown as Operator<Value>;
};

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

const ops = {
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
  between: make<[unknown, unknown]>(
    (key, [from, to], ctx, quotedAs) =>
      `${key} BETWEEN ${quoteValue(from, ctx, quotedAs)} AND ${quoteValue(
        to,
        ctx,
        quotedAs,
      )}`,
  ),
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
  and: make(
    (key, value, ctx, quotedAs) =>
      `${key} AND ${value.q.expr.toSQL(ctx, quotedAs)}`,
  ),
  or: make(
    (key, value, ctx, quotedAs) =>
      `(${key}) OR (${value.q.expr.toSQL(ctx, quotedAs)})`,
  ),
};

type Base<Value> = {
  equals: Operator<Value | Query | Expression, BooleanColumn>;
  not: Operator<Value | Query | Expression, BooleanColumn>;
  in: Operator<Value[] | Query | Expression, BooleanColumn>;
  notIn: Operator<Value[] | Query | Expression, BooleanColumn>;
};

const base = {
  equals: ops.equals,
  not: ops.not,
  in: ops.in,
  notIn: ops.notIn,
} as Base<unknown>;

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
  and: ops.and,
  or: ops.or,
} as Bool;

type Numeric<Value> = Base<Value> & {
  lt: Operator<Value | Query | Expression, BooleanColumn>;
  lte: Operator<Value | Query | Expression, BooleanColumn>;
  gt: Operator<Value | Query | Expression, BooleanColumn>;
  gte: Operator<Value | Query | Expression, BooleanColumn>;
  between: Operator<
    [Value | Query | Expression, Value | Query | Expression],
    BooleanColumn
  >;
};

const numeric = {
  ...base,
  lt: ops.lt,
  lte: ops.lte,
  gt: ops.gt,
  gte: ops.gte,
  between: ops.between,
};

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
  contains: ops.contains,
  containsSensitive: ops.containsSensitive,
  startsWith: ops.startsWith,
  startsWithSensitive: ops.startsWithSensitive,
  endsWith: ops.endsWith,
  endsWithSensitive: ops.endsWithSensitive,
} as Text;

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
  jsonPath: ops.jsonPath,
  jsonSupersetOf: ops.jsonSupersetOf,
  jsonSubsetOf: ops.jsonSubsetOf,
} as Json;

export const Operators = {
  any: base,
  boolean,
  number: numeric,
  date: base,
  time: base,
  text,
  json,
  array: base,
} as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any: Base<any>;
  boolean: Bool;
  number: Numeric<number>;
  date: Numeric<number>;
  time: Numeric<number>;
  text: Text;
  json: Json;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: Base<any>;
};
