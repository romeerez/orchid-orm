import { cloneQueryArrays, QueryData, toSqlCacheKey } from './sql';
import type { Query, Selectable } from './query';
import type {
  RawExpression,
  ColumnOutput,
  ColumnTypeBase,
  StringKey,
} from 'orchid-core';

export const getClonedQueryData = (query: QueryData): QueryData => {
  const cloned = { ...query };
  delete cloned[toSqlCacheKey];
  if (cloned.parsers) cloned.parsers = { ...cloned.parsers };
  cloneQueryArrays(cloned);
  return cloned as QueryData;
};

export const getQueryAs = (q: { table?: string; query: { as?: string } }) => {
  return q.query.as || (q.table as string);
};

export const makeRegexToFindInSql = (value: string) => {
  return new RegExp(`${value}(?=(?:[^']*'[^']*')*[^']*$)`, 'g');
};

export type AliasOrTable<T extends Pick<Query, 'table' | 'meta'>> =
  T['meta']['as'] extends string
    ? T['meta']['as']
    : T['table'] extends string
    ? T['table']
    : never;

export type Expression<
  T extends Query = Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = StringKey<keyof T['selectable']> | RawExpression<C>;

export type ExpressionOfType<T extends Query, C extends ColumnTypeBase, Type> =
  | {
      [K in keyof T['selectable']]: ColumnOutput<
        T['selectable'][K]['column']
      > extends Type | null
        ? K
        : never;
    }[Selectable<T>]
  | RawExpression<C>;

export type NumberExpression<
  T extends Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = ExpressionOfType<T, C, number>;

export type StringExpression<
  T extends Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = ExpressionOfType<T, C, string>;

export type BooleanExpression<
  T extends Query,
  C extends ColumnTypeBase = ColumnTypeBase,
> = ExpressionOfType<T, C, boolean>;

export type ExpressionOutput<
  T extends Query,
  Expr extends Expression<T>,
> = Expr extends keyof T['selectable']
  ? T['selectable'][Expr]['column']
  : Expr extends RawExpression<infer ColumnTypeBase>
  ? ColumnTypeBase
  : never;
