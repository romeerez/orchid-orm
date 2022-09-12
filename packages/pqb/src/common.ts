import { Query, Selectable } from './query';
import { ColumnOutput, ColumnType } from './columnSchema';

export type AliasOrTable<T extends Pick<Query, 'tableAlias' | 'table'>> =
  T['tableAlias'] extends string
    ? T['tableAlias']
    : T['table'] extends string
    ? T['table']
    : never;

export type StringKey<K extends PropertyKey> = Exclude<K, symbol | number>;

export type RawExpression<C extends ColumnType = ColumnType> = {
  __raw: string;
  __values: unknown[];
  __column: C;
};

export type Expression<
  T extends Query = Query,
  C extends ColumnType = ColumnType,
> = keyof T['selectable'] | RawExpression<C>;

export type ExpressionOfType<T extends Query, C extends ColumnType, Type> =
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
  C extends ColumnType = ColumnType,
> = ExpressionOfType<T, C, number>;

export type StringExpression<
  T extends Query,
  C extends ColumnType = ColumnType,
> = ExpressionOfType<T, C, string>;

export type BooleanExpression<
  T extends Query,
  C extends ColumnType = ColumnType,
> = ExpressionOfType<T, C, boolean>;

export type ExpressionOutput<
  T extends Query,
  Expr extends Expression<T>,
> = Expr extends keyof T['selectable']
  ? T['selectable'][Expr]['column']
  : Expr extends RawExpression<infer ColumnType>
  ? ColumnType
  : never;

export const raw = <C extends ColumnType>(sql: string, ...values: unknown[]) =>
  ({
    __raw: sql,
    __values: values,
  } as RawExpression<C>);

export const rawColumn = <C extends ColumnType>(
  column: C,
  sql: string,
  ...values: unknown[]
) =>
  ({
    __column: column,
    __raw: sql,
    __values: values,
  } as RawExpression<C>);

export const isRaw = (obj: object): obj is RawExpression => '__raw' in obj;

export const getRaw = (raw: RawExpression, values: unknown[]) => {
  values.push(...raw.__values);
  return raw.__raw;
};

export const EMPTY_OBJECT = {};

export const getQueryParsers = (q: Query) => {
  return q.query.parsers || q.columnsParsers;
};
