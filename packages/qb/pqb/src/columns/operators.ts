import { Query } from '../query/query';
import { addValue } from '../sql/common';
import {
  Expression,
  isExpression,
  ColumnOperatorBase,
  ColumnOperatorFnBase,
  ColumnTypeBase,
} from 'orchid-core';
import { ToSQLCtx } from '../sql';

type Fn<T> = ColumnOperatorFnBase<T, ToSQLCtx>;

export type Operator<T> = ColumnOperatorBase<T, ToSQLCtx>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, Operator<any>>;

export const createOperator = <T>(fn: Fn<T>): Operator<T> => {
  return Object.assign(fn, { type: undefined as unknown as T });
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

const all = {
  equals: <T>() =>
    createOperator<T | Query | Expression>((key, value, ctx, quotedAs) =>
      value === null
        ? `${key} IS NULL`
        : `${key} = ${quoteValue(value, ctx, quotedAs)}`,
    ),
  not: <T>() =>
    createOperator<T | Query | Expression>((key, value, ctx, quotedAs) =>
      value === null
        ? `${key} IS NOT NULL`
        : `${key} <> ${quoteValue(value, ctx, quotedAs)}`,
    ),
  in: <T>() =>
    createOperator<T[] | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} IN ${quoteValue(value, ctx, quotedAs)}`,
    ),
  notIn: <T>() =>
    createOperator<T[] | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `NOT ${key} IN ${quoteValue(value, ctx, quotedAs)}`,
    ),
  lt: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} < ${quoteValue(value, ctx, quotedAs)}`,
    ),
  lte: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} <= ${quoteValue(value, ctx, quotedAs)}`,
    ),
  gt: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} > ${quoteValue(value, ctx, quotedAs)}`,
    ),
  gte: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} >= ${quoteValue(value, ctx, quotedAs)}`,
    ),
  contains: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} ILIKE '%' || ${quoteValue(value, ctx, quotedAs)} || '%'`,
    ),
  containsSensitive: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} LIKE '%' || ${quoteValue(value, ctx, quotedAs)} || '%'`,
    ),
  startsWith: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} ILIKE ${quoteValue(value, ctx, quotedAs)} || '%'`,
    ),
  startsWithSensitive: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} LIKE ${quoteValue(value, ctx, quotedAs)} || '%'`,
    ),
  endsWith: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} ILIKE '%' || ${quoteValue(value, ctx, quotedAs)}`,
    ),
  endsWithSensitive: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} LIKE '%' || ${quoteValue(value, ctx, quotedAs)}`,
    ),
  between: <T>() =>
    createOperator<[T | Query | Expression, T | Query | Expression]>(
      (key, [from, to], ctx, quotedAs) =>
        `${key} BETWEEN ${quoteValue(from, ctx, quotedAs)} AND ${quoteValue(
          to,
          ctx,
          quotedAs,
        )}`,
    ),
  jsonPath: <T>() =>
    createOperator<[path: string, op: string, value: T | Query | Expression]>(
      (key, [path, op, value], ctx, quotedAs) =>
        `jsonb_path_query_first(${key}, '${path}') #>> '{}' ${op} ${quoteValue(
          value,
          ctx,
          quotedAs,
          true,
        )}`,
    ),
  jsonSupersetOf: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} @> ${quoteValue(value, ctx, quotedAs, true)}`,
    ),
  jsonSubsetOf: <T>() =>
    createOperator<T | Query | Expression>(
      (key, value, ctx, quotedAs) =>
        `${key} <@ ${quoteValue(value, ctx, quotedAs, true)}`,
    ),
};

const base = <T>() => ({
  equals: all.equals<T>(),
  not: all.not<T>(),
  in: all.in<T>(),
  notIn: all.notIn<T>(),
});

const boolean = () => ({
  ...base<boolean>(),
  and: createOperator<Expression<ColumnTypeBase<boolean | null>>>(
    (key, value, ctx, quotedAs) => `${key} AND ${value.toSQL(ctx, quotedAs)}`,
  ),
  or: createOperator<Expression<ColumnTypeBase<boolean | null>>>(
    (key, value, ctx, quotedAs) =>
      `(${key}) OR (${value.toSQL(ctx, quotedAs)})`,
  ),
});

const numeric = <T>() => ({
  ...base<T>(),
  lt: all.lt<T>(),
  lte: all.lte<T>(),
  gt: all.gt<T>(),
  gte: all.gte<T>(),
  between: all.between<T>(),
});

const text = <T>() => ({
  ...base<T>(),
  contains: all.contains<T>(),
  containsSensitive: all.containsSensitive<T>(),
  startsWith: all.startsWith<T>(),
  startsWithSensitive: all.startsWithSensitive<T>(),
  endsWith: all.endsWith<T>(),
  endsWithSensitive: all.endsWithSensitive<T>(),
});

const json = <T>() => ({
  ...base<T>(),
  jsonPath: all.jsonPath<T>(),
  jsonSupersetOf: all.jsonSupersetOf<T>(),
  jsonSubsetOf: all.jsonSubsetOf<T>(),
});

export const Operators = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any: base<any>(),
  boolean: boolean(),
  number: numeric<number>(),
  date: numeric<Date>(),
  time: numeric<Date>(),
  text: text<string>(),
  json: json<unknown>(),
  // TODO: array operators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  array: base<any>(),
};
