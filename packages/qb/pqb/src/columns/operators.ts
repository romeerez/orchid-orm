import {
  PickQueryBaseQuery,
  PickQueryQ,
  Query,
  SetQueryReturnsColumnOrThrow,
} from '../query/query';
import { ToSQLCtx } from '../sql';
import { addValue } from '../sql/common';
import {
  Expression,
  getValueKey,
  isExpression,
  OperatorToSQL,
  PickOutputTypeAndOperators,
  PickQueryResult,
} from 'orchid-core';
import { BooleanQueryColumn } from '../queryMethods';

// Operator function type.
// Table.count().gt(10) <- here `.gt(10)` is this operator function.
// It discards previously defined column type operators and applies new ones,
// for a case when operator gives a different column type.
export interface Operator<
  Value,
  Column extends PickOutputTypeAndOperators = PickOutputTypeAndOperators,
> {
  <T extends PickQueryResult>(this: T, arg: Value):
    | Omit<
        SetQueryReturnsColumnOrThrow<T, Column>,
        keyof T['result']['value']['operators']
      > &
        Column['operators'];
  // argument type of the function
  _opType: Value;
  // function to turn the operator expression into SQL
  // unknown fails tests in rake-db when applying nullable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _op: OperatorToSQL<any, ToSQLCtx>;
}

// any column has 'operators' record that implements this type
export interface BaseOperators {
  [K: string]: Operator<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Extend query object with given operator methods, so that user can call `gt` after calling `count`.
// If query already has the same operators, nothing is changed.
// Previously defined operators, if any, are **not** dropped from the query.
export function setQueryOperators(
  query: PickQueryBaseQuery,
  operators: BaseOperators,
) {
  const q = (query as unknown as PickQueryQ).q;

  if (q.operators !== operators) {
    q.operators = operators;
    Object.assign(query, operators);
  }

  return query;
}

/**
 * Makes operator function that has `_op` property.
 *
 * @param _op - function to turn the operator call into SQL.
 */
const make = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _op: (key: string, value: any, ctx: ToSQLCtx, quotedAs?: string) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Operator<any> => {
  return Object.assign(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function (this: Query, value: any) {
      (this.q.chain ??= []).push(_op, value);

      // parser might be set by a previous type, but is not needed for boolean
      if (this.q.parsers?.[getValueKey]) {
        this.q.parsers[getValueKey] = undefined;
      }

      return setQueryOperators(this, boolean);
    },
    {
      _op,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as never;
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
  equals: Operator<Value | Query | Expression, BooleanQueryColumn>;
  not: Operator<Value | Query | Expression, BooleanQueryColumn>;
  in: Operator<Value[] | Query | Expression, BooleanQueryColumn>;
  notIn: Operator<Value[] | Query | Expression, BooleanQueryColumn>;
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
export type OperatorsBoolean = Base<boolean> & {
  and: Operator<
    {
      result: { value: BooleanQueryColumn };
    } & OperatorsBoolean,
    BooleanQueryColumn
  >;
  or: Operator<
    {
      result: { value: BooleanQueryColumn };
    } & OperatorsBoolean,
    BooleanQueryColumn
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
} as unknown as OperatorsBoolean;

// Numeric, date, and time can be compared with `lt`, `gt`, so it's generic.
type Ord<Value> = Base<Value> & {
  lt: Operator<Value | Query | Expression, BooleanQueryColumn>;
  lte: Operator<Value | Query | Expression, BooleanQueryColumn>;
  gt: Operator<Value | Query | Expression, BooleanQueryColumn>;
  gte: Operator<Value | Query | Expression, BooleanQueryColumn>;
  between: Operator<
    [Value | Query | Expression, Value | Query | Expression],
    BooleanQueryColumn
  >;
};

export type OperatorsNumber = Ord<number>;

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
  between: make(
    (key, [from, to], ctx, quotedAs) =>
      `${key} BETWEEN ${quoteValue(from, ctx, quotedAs)} AND ${quoteValue(
        to,
        ctx,
        quotedAs,
      )}`,
  ),
} as OperatorsNumber;

// Text type operators
export type OperatorsText = Base<string> & {
  contains: Operator<string | Query | Expression, BooleanQueryColumn>;
  containsSensitive: Operator<string | Query | Expression, BooleanQueryColumn>;
  startsWith: Operator<string | Query | Expression, BooleanQueryColumn>;
  startsWithSensitive: Operator<
    string | Query | Expression,
    BooleanQueryColumn
  >;
  endsWith: Operator<string | Query | Expression, BooleanQueryColumn>;
  endsWithSensitive: Operator<string | Query | Expression, BooleanQueryColumn>;
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
} as OperatorsText;

// JSON type operators
export type OperatorsJson = Base<unknown> & {
  jsonPath: Operator<
    [path: string, op: string, value: unknown | Query | Expression],
    BooleanQueryColumn
  >;
  jsonSupersetOf: Operator<unknown | Query | Expression, BooleanQueryColumn>;
  jsonSubsetOf: Operator<unknown | Query | Expression, BooleanQueryColumn>;
};

const json = {
  ...base,
  jsonPath: make(
    (key, [path, op, value], ctx, quotedAs) =>
      `jsonb_path_query_first(${key}, '${path}') #>> '{}' ${op} ${
        value === null ? 'null' : quoteValue(value, ctx, quotedAs, true)
      }`,
  ),
  jsonSupersetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} @> ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
  jsonSubsetOf: make(
    (key, value, ctx, quotedAs) =>
      `${key} <@ ${quoteValue(value, ctx, quotedAs, true)}`,
  ),
} as OperatorsJson;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperatorsAny = Base<any>;
export type OperatorsDate = Ord<Date | string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperatorsArray = Base<any>;

export type OperatorsTime = Ord<string>;

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
  any: OperatorsAny;
  boolean: OperatorsBoolean;
  number: OperatorsNumber;
  date: OperatorsDate;
  time: OperatorsTime;
  text: OperatorsText;
  json: OperatorsJson;
  array: OperatorsArray;
};
