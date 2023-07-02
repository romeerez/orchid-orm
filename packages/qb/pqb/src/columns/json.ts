import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import { columnCode } from './code';
import { Code, JSONType, JSONTypes, jsonTypes, JSONUnknown } from 'orchid-core';

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
    return columnCode(this, t, `json((t) => ${schema.toCode('t')})`);
  }
}

export class JSONTextColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'json' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `jsonText()`);
  }
}
