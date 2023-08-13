export type ColumnOperatorBase<Value, Ctx> = {
  (): void;
  _opType: Value;
  _op: (key: string, value: Value, ctx: Ctx, quotedAs?: string) => string;
};

// Base type for the object with column operators.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, ColumnOperatorBase<any, any>>;
