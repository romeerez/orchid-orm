import { Query } from '../query/query';
import { ToSQLCtx } from '../sql';
import { addValue } from '../sql/common';
import { ColumnTypeBase, Expression, isExpression } from 'orchid-core';

export type Operator<Value> = {
  (): void;
  _opType: Value;
  _op: (key: string, value: Value, ctx: ToSQLCtx, quotedAs?: string) => string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, Operator<any>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const make = <Value = any>(
  _op: (key: string, value: Value, ctx: ToSQLCtx, quotedAs?: string) => string,
): Operator<Value> => {
  return Object.assign(
    function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return {} as any;
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
    (key, value, ctx, quotedAs) => `${key} AND ${value.toSQL(ctx, quotedAs)}`,
  ),
  or: make(
    (key, value, ctx, quotedAs) =>
      `(${key}) OR (${value.toSQL(ctx, quotedAs)})`,
  ),
};

type Base<Value> = {
  equals: Operator<Value | Query | Expression>;
  not: Operator<Value | Query | Expression>;
  in: Operator<Value[] | Query | Expression>;
  notIn: Operator<Value[] | Query | Expression>;
};

const base: Base<unknown> = {
  equals: ops.equals,
  not: ops.not,
  in: ops.in,
  notIn: ops.notIn,
};

const boolean = {
  ...base,
  and: ops.and,
  or: ops.or,
} as Base<boolean> & {
  and: Operator<Expression<ColumnTypeBase<boolean | null>>>;
  or: Operator<Expression<ColumnTypeBase<boolean | null>>>;
};

type Numeric<Value> = Base<Value> & {
  lt: Operator<Value | Query | Expression>;
  lte: Operator<Value | Query | Expression>;
  gt: Operator<Value | Query | Expression>;
  gte: Operator<Value | Query | Expression>;
  between: Operator<[Value | Query | Expression, Value | Query | Expression]>;
};

const numeric = {
  ...base,
  lt: ops.lt,
  lte: ops.lte,
  gt: ops.gt,
  gte: ops.gte,
  between: ops.between,
};

const text = {
  ...base,
  contains: ops.contains,
  containsSensitive: ops.containsSensitive,
  startsWith: ops.startsWith,
  startsWithSensitive: ops.startsWithSensitive,
  endsWith: ops.endsWith,
  endsWithSensitive: ops.endsWithSensitive,
} as Base<string> & {
  contains: Operator<string | Query | Expression>;
  containsSensitive: Operator<string | Query | Expression>;
  startsWith: Operator<string | Query | Expression>;
  startsWithSensitive: Operator<string | Query | Expression>;
  endsWith: Operator<string | Query | Expression>;
  endsWithSensitive: Operator<string | Query | Expression>;
};

const json: Base<unknown> & {
  jsonPath: Operator<
    [path: string, op: string, value: unknown | Query | Expression]
  >;
  jsonSupersetOf: Operator<unknown | Query | Expression>;
  jsonSubsetOf: Operator<unknown | Query | Expression>;
} = {
  ...base,
  jsonPath: ops.jsonPath,
  jsonSupersetOf: ops.jsonSupersetOf,
  jsonSubsetOf: ops.jsonSubsetOf,
};

export const Operators = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any: base as Base<any>,
  boolean,
  number: numeric as Numeric<number>,
  date: base as Numeric<Date>,
  time: base as Numeric<Date>,
  text,
  json,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: base as Base<any>,
};
