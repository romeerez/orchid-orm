import { ColumnTypeBase, ColumnTypesBase } from './columns/columnType';
import { EmptyObject } from './utils';

// Base class for the raw SQL and other classes that can produce SQL
export abstract class Expression<T extends ColumnTypeBase = ColumnTypeBase> {
  // `_type` contains an instance of a column type.
  // Starts with underscore to allow having `type` method
  abstract _type: T;

  // Produce SQL string, push query variables into given `values` array.
  abstract toSQL(
    ctx: { values: unknown[] },
    quotedAs: string | undefined,
  ): string;
}

// Check if the unknown thing is an Expression
export const isExpression = (arg: unknown): arg is Expression =>
  arg instanceof Expression;

// Object representing SQL query.
// Constructed by `toSql`, passed to adapter.query and adapter.array
export type TemplateLiteralArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

export const isTemplateLiteralArgs = (
  args: unknown[],
): args is TemplateLiteralArgs =>
  Array.isArray(args[0]) && 'raw' in args[0] && Array.isArray(args[0].raw);

// Argument type for `sql` function.
export type RawSQLArgs =
  | TemplateLiteralArgs
  | [{ raw: string; values?: RawSQLValues }];

export type RawSQLValues = Record<string, unknown>;

// Base class for raw SQL
export abstract class RawSQLBase<
  T extends ColumnTypeBase = ColumnTypeBase,
  CT extends ColumnTypesBase = EmptyObject,
> extends Expression<T> {
  // Column type instance, it is assigned directly to the prototype of RawSQL class.
  declare _type: T;

  // Column types are stored to be passed to the `type` callback.
  abstract columnTypes: CT;

  // Produce SQL string, push query variables into given `values` array.
  abstract toSQL(ctx: { values: unknown[] }): string;

  constructor(
    public _sql: string | TemplateLiteralArgs,
    public _values?: RawSQLValues,
  ) {
    super();
  }

  // Define the resulting column type for the raw SQL.
  type<Self extends RawSQLBase, C extends ColumnTypeBase>(
    this: Self,
    fn: (types: Self['columnTypes']) => C,
  ): Omit<Self, '_type'> & { _type: C } {
    this._type = fn(this.columnTypes);
    return this as unknown as Omit<Self, '_type'> & { _type: C };
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

// Check if something is a raw SQL.
export const isRawSQL = (arg: unknown): arg is RawSQLBase =>
  arg instanceof RawSQLBase;
