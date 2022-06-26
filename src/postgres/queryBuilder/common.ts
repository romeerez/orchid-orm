import { Base } from '../model';

export type RawExpression = { raw: string }

export type Expression<T extends Base> = keyof T['type'] | RawExpression

export type ExpressionOfType<T extends Base, Type> = { [K in keyof T['type']]: T['type'][K] extends Type ? K : never }[keyof T['type']] | RawExpression

export type NumberExpression<T extends Base> = ExpressionOfType<T, number>

export type StringExpression<T extends Base> = ExpressionOfType<T, string>

export type BooleanExpression<T extends Base> = ExpressionOfType<T, boolean>

export type ExpressionOutput<T extends Base, Expr extends Expression<T>>
  = Expr extends keyof T['type'] ? T['type'][Expr] : unknown
