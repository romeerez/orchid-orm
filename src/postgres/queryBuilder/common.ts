import { Base } from '../model';

export type Expression<T extends Base> = keyof T['type'] | { raw: string }

export type ExpressionOutput<T extends Base, Expr extends Expression<T>>
  = Expr extends keyof T['type'] ? T['type'][Expr] : unknown
