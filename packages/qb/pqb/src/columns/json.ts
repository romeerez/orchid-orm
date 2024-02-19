import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Operators, OperatorsJson, OperatorsText } from './operators';
import { Code, ColumnSchemaConfig } from 'orchid-core';

// skip adding the default `encode` function to code
const toCodeSkip = { encodeFn: JSON.stringify };

// Type of JSON column (jsonb).
export class JSONColumn<
  T,
  Schema extends ColumnSchemaConfig,
> extends ColumnType<Schema, T, Schema['type'], OperatorsJson> {
  dataType = 'jsonb' as const;
  operators = Operators.json;
  toCode(t: string): Code {
    return columnCode(this, t, `json()`, this.data, toCodeSkip);
  }
}

// Encode data of both types with JSON.stringify
JSONColumn.prototype.encodeFn = JSON.stringify;

// JSON non-binary type, stored as a text in the database, so it doesn't have rich functionality.
export class JSONTextColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<Schema, string, Schema['stringSchema'], OperatorsText> {
  dataType = 'json' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `jsonText()`, this.data, toCodeSkip);
  }
}
