import { Query } from './query';

export type RawExpression<R = unknown> = { __raw: string; __type: R };

export type Expression<T extends Query, R = unknown> =
  | keyof T['type']
  | RawExpression<R>;

export type ExpressionOfType<T extends Query, R, Type> =
  | {
      [K in keyof T['type']]: T['type'][K] extends Type ? K : never;
    }[keyof T['type']]
  | RawExpression<R>;

export type NumberExpression<T extends Query, R = unknown> = ExpressionOfType<
  T,
  R,
  number
>;

export type StringExpression<T extends Query, R = unknown> = ExpressionOfType<
  T,
  R,
  string
>;

export type BooleanExpression<T extends Query, R = unknown> = ExpressionOfType<
  T,
  R,
  boolean
>;

export type ExpressionOutput<
  T extends Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Expr extends Expression<T, any>,
> = Expr extends keyof T['type']
  ? T['type'][Expr]
  : Expr extends RawExpression<infer R>
  ? R
  : never;

export const raw = <R = unknown>(sql: string) =>
  ({
    __raw: sql,
  } as RawExpression<R>);

export const isRaw = (obj: object): obj is RawExpression => '__raw' in obj;

export const getRaw = (raw: RawExpression) => raw.__raw;
