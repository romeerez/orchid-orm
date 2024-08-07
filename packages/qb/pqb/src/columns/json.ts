import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Operators, OperatorsJson, OperatorsText } from './operators';
import {
  Code,
  ColumnSchemaConfig,
  ColumnToCodeCtx,
  ColumnTypeSchemaArg,
} from 'orchid-core';

const encodeFn = (x: unknown) => (x === null ? x : JSON.stringify(x));

// skip adding the default `encode` function to code
const toCodeSkip = { encodeFn };

// Type of JSON column (jsonb).
export class JSONColumn<
  T,
  Schema extends ColumnTypeSchemaArg,
> extends ColumnType<Schema, T, Schema['type'], OperatorsJson> {
  dataType = 'jsonb' as const;
  operators = Operators.json;
  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `json()`, this.data, toCodeSkip);
  }
}

// Encode data of both types with JSON.stringify
JSONColumn.prototype.encodeFn = encodeFn;

// JSON non-binary type, stored as a text in the database, so it doesn't have rich functionality.
export class JSONTextColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'json' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `jsonText()`, this.data, toCodeSkip);
  }
}
