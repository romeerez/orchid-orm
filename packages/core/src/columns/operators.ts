// Base type for column operator functions such as `gt`, `lt`.

export type OperatorBase<Value> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (this: any, arg: Value): any;
  // Argument type of the function.
  _opType: Value;
};

/**
 * Function to turn the operator expression into SQL.
 *
 * @param key - SQL of the target to apply operator for, can be a quoted column name or an SQL expression wrapped with parens.
 * @param args - arguments of operator function.
 * @param ctx - context object for SQL conversions, for collecting query variables.
 * @param quotedAs - quoted table name.
 */
export type OperatorToSQL<Value, Ctx> = (
  key: string,
  args: [Value],
  ctx: Ctx,
  quotedAs?: string,
) => string;
