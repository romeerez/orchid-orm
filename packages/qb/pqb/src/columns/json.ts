import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Operators, OperatorsJson, OperatorsText } from './operators';
import {
  Code,
  ColumnSchemaConfig,
  ColumnToCodeCtx,
  ColumnTypeSchemaArg,
} from 'orchid-core';

const encode = (x: unknown) => (x === null ? x : JSON.stringify(x));

// Type of JSON column (jsonb).
export class JSONColumn<
  T,
  Schema extends ColumnTypeSchemaArg,
  InputSchema = Schema['type'],
> extends ColumnType<Schema, T, InputSchema, OperatorsJson> {
  dataType = 'jsonb' as const;
  operators = Operators.json;

  constructor(schema: Schema, inputType: Schema['type']) {
    super(schema, inputType as InputSchema);
    this.data.encode = this.data.defaultEncode = encode;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `json()`);
  }
}

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
    return columnCode(this, ctx, key, `jsonText()`);
  }
}
