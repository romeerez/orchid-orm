import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import { columnCode } from './code';
import {
  addCode,
  Code,
  JSONType,
  JSONTypes,
  jsonTypes,
  JSONUnknown,
  toArray,
} from 'orchid-core';

// skip adding the default `encode` function to code
const toCodeSkip = { encodeFn: JSON.stringify };

// Type of JSON column (jsonb).
export class JSONColumn<Type extends JSONType = JSONUnknown> extends ColumnType<
  Type['type'],
  typeof Operators.json
> {
  dataType = 'jsonb' as const;
  operators = Operators.json;
  declare data: ColumnData & { schema: Type };

  constructor(
    schemaOrFn:
      | Type
      | ((j: JSONTypes) => Type) = new JSONUnknown() as unknown as Type,
  ) {
    super();

    this.data.schema =
      typeof schemaOrFn === 'function' ? schemaOrFn(jsonTypes) : schemaOrFn;
  }

  toCode(t: string): Code {
    const { schema } = this.data;
    const schemaCode = toArray(schema.toCode(t));
    addCode(schemaCode, ',');
    return columnCode(
      this,
      t,
      [`json((${t}) =>`, schemaCode, ')'],
      this.data,
      toCodeSkip,
    );
  }
}

// JSON non-binary type, stored as a text in the database, so it doesn't have rich functionality.
export class JSONTextColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'json' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `jsonText()`, this.data, toCodeSkip);
  }
}

// Encode data of both types with JSON.stringify
JSONColumn.prototype.encodeFn = JSONTextColumn.prototype.encodeFn =
  JSON.stringify;
