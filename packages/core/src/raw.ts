import { ColumnTypeBase, QueryColumn } from './columns/columnType';
import { OperatorToSQL } from './columns';
import { RecordUnknown } from './utils';

// The chain array is used to store a sequence of operators and their arguments, one be one.
// For example, expression of numeric type may be chained to `lt`, `gt` and similar functions.
export type ExpressionChain = (OperatorToSQL<unknown, unknown> | unknown)[];

export type ExpressionData = {
  chain?: ExpressionChain;
  expr?: Expression;
};

// Base class for the raw SQL and other classes that can produce SQL
export abstract class Expression<T extends QueryColumn = QueryColumn> {
  // `result` contains an instance of a column type.
  // Starts with underscore to allow having `type` method
  abstract result: { value: T };

  abstract q: ExpressionData;

  // Produce SQL string by calling `makeSQL` and applying operators from the `q.chain`, push query variables into given `values` array.
  toSQL(ctx: { values: unknown[] }, quotedAs?: string): string {
    let sql = this.makeSQL(ctx, quotedAs);
    if (this.q.chain) {
      const { chain: chain } = this.q;
      for (let i = 0, len = chain.length; i < len; i += 2) {
        sql = (chain[i] as OperatorToSQL<unknown, unknown>)(
          sql,
          chain[i + 1],
          ctx,
          quotedAs,
        );
      }
    }
    return sql;
  }

  // `makeSQL` should be implemented on subclasses of Expression to return SQL of the expression.
  // Result of `makeSQL` will be chained with operators by `toSQL`.
  abstract makeSQL(ctx: { values: unknown[] }, quotedAs?: string): string;
}

// Check if the unknown thing is an Expression
export const isExpression = (arg: unknown): arg is Expression =>
  arg instanceof Expression;

// Object representing SQL query.
// Constructed by `toSQL`, passed to adapter.query and adapter.array
export type TemplateLiteralArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

// Check if arguments are a template literal.
export const isTemplateLiteralArgs = (
  args: unknown[],
): args is TemplateLiteralArgs =>
  Array.isArray(args[0]) && 'raw' in args[0] && Array.isArray(args[0].raw);

// Argument type for `sql` function.
// It can take a template literal, an object `{ raw: string, values?: Record<string, unknown> }`,
// or a function to build SQL lazily.
export type SQLArgs = StaticSQLArgs | [DynamicSQLArg];

// Function for sql method to build SQL lazily (dynamically).
// May be used for computed column to build a different SQL in different executions.
export type DynamicSQLArg = (
  sql: (...args: StaticSQLArgs) => Expression,
) => Expression;

// SQL arguments for a non-lazy SQL expression.
export type StaticSQLArgs =
  | TemplateLiteralArgs
  | [{ raw: string; values?: RawSQLValues }];

// Record of values to pass and store in a RawSQL instance.
export type RawSQLValues = RecordUnknown;

// `type` method to be used in both static and dynamic variants of SQL expressions.
export abstract class ExpressionTypeMethod {
  // Define the resulting column type for the raw SQL.
  type<Self extends RawSQLBase, C extends QueryColumn>(
    this: Self,
    fn: (types: Self['columnTypes']) => C,
  ): // Omit is optimal
  Omit<Self, 'result'> & { result: { value: C } } {
    this.result.value = fn(this.columnTypes) as unknown as ColumnTypeBase;
    Object.assign(this, this.result.value.operators);
    return this as never;
  }
}

// RawSQLBase extends both Expression and ExpressionTypeMethod, so it needs a separate interface.
export interface RawSQLBase<
  T extends QueryColumn = QueryColumn,
  ColumnTypes = unknown,
> extends Expression<T>,
    ExpressionTypeMethod {}

// Base class for raw SQL
export abstract class RawSQLBase<
  T extends QueryColumn = QueryColumn,
  ColumnTypes = unknown,
> extends Expression<T> {
  // Column type instance, it is assigned directly to the prototype of RawSQL class.
  declare result: { value: T };
  q: ExpressionData = {};

  // Column types are stored to be passed to the `type` callback.
  abstract columnTypes: ColumnTypes;

  // Produce SQL string, push query variables into given `values` array.
  abstract makeSQL(ctx: { values: unknown[] }): string;

  constructor(
    public _sql: string | TemplateLiteralArgs,
    public _values?: RawSQLValues,
  ) {
    super();
  }

  // Attach query variables to the raw SQL.
  values<Self extends RawSQLBase>(this: Self, values: RawSQLValues): Self {
    this._values = values;
    return this;
  }

  // Convert raw SQL to code for a code generator.
  toCode(t: string): string {
    const { _sql: sql, _values: values } = this;
    let code = `${t}.sql`;

    if (typeof sql === 'string') {
      code += `({ raw: '${sql.replace(/'/g, "\\'")}' })`;
    } else {
      code += '`';

      const parts = sql[0];
      let i = 0;
      for (let last = parts.length - 1; i < last; i++) {
        code += parts[i] + `\${${sql[i + 1]}}`;
      }
      code += parts[i];

      code += '`';
    }

    if (values) {
      code += `.values(${JSON.stringify(values)})`;
    }

    return code;
  }
}

RawSQLBase.prototype.type = ExpressionTypeMethod.prototype.type;

// Check if something is a raw SQL.
export const isRawSQL = (arg: unknown): arg is RawSQLBase =>
  arg instanceof RawSQLBase;
