import { Query, Selectable } from './query';
import { Column } from './schema';

export type AliasOrTable<T extends Pick<Query, 'tableAlias' | 'table'>> =
  T['tableAlias'] extends string
    ? T['tableAlias']
    : T['table'] extends string
    ? T['table']
    : never;

export type StringKey<K extends PropertyKey> = Exclude<K, symbol | number>;

export type RawExpression<C extends Column = Column> = {
  __raw: string;
  __type: C;
};

export type Expression<T extends Query = Query, C extends Column = Column> =
  | keyof T['selectable']
  | RawExpression<C>;

export type ExpressionOfType<T extends Query, C extends Column, Type> =
  | {
      [K in keyof T['selectable']]: T['selectable'][K]['_output'] extends Type
        ? K
        : never;
    }[Selectable<T>]
  | RawExpression<C>;

export type NumberExpression<
  T extends Query,
  C extends Column = Column,
> = ExpressionOfType<T, C, number>;

export type StringExpression<
  T extends Query,
  C extends Column = Column,
> = ExpressionOfType<T, C, string>;

export type BooleanExpression<
  T extends Query,
  C extends Column = Column,
> = ExpressionOfType<T, C, boolean>;

export type ExpressionOutput<
  T extends Query,
  Expr extends Expression<T>,
> = Expr extends keyof T['selectable']
  ? T['selectable'][Expr]
  : Expr extends RawExpression<infer Column>
  ? Column
  : never;

export const raw = <C extends Column = Column>(sql: string) =>
  ({
    __raw: sql,
  } as RawExpression<C>);

export const isRaw = (obj: object): obj is RawExpression => '__raw' in obj;

export const getRaw = (raw: RawExpression) => raw.__raw;

export const EMPTY_OBJECT = {};
