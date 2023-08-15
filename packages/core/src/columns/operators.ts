export type OperatorBase<Value, Ctx> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (this: any, arg: Value): any;
  _opType: Value;
  _op: OperatorToSQL<Value, Ctx>;
};

export type OperatorToSQL<Value, Ctx> = (
  key: string,
  value: Value,
  ctx: Ctx,
  quotedAs?: string,
) => string;

// Base type for the object with column operators.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, OperatorBase<any, any>>;
