// Base type for column operator function.
// `orchid-core` doesn't know the concrete type of Ctx (ToSqlCtx), so it's a generic
export type ColumnOperatorFnBase<T, Ctx> = (
  key: string,
  value: T,
  ctx: Ctx,
  quotedAs: string | undefined,
) => string;

// Base type for column operator.
export type ColumnOperatorBase<T, Ctx> = ColumnOperatorFnBase<T, Ctx> & {
  type: T;
};

// Base type for the object with column operators.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, ColumnOperatorBase<any, any>>;
