export type ColumnOperatorFnBase<T, Ctx> = (
  key: string,
  value: T,
  ctx: Ctx,
  quotedAs: string | undefined,
) => string;

export type ColumnOperatorBase<T, Ctx> = ColumnOperatorFnBase<T, Ctx> & {
  type: T;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, ColumnOperatorBase<any, any>>;
