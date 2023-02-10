import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import {
  scalarTypes,
  array,
  discriminatedUnion,
  enumType,
  instanceOf,
  intersection,
  lazy,
  literal,
  map,
  nativeEnum,
  nullable,
  nullish,
  object,
  optional,
  record,
  set,
  tuple,
  union,
  JSONTypeAny,
} from './json';
import { Code, columnCode } from './code';

export * from './json/index';

export type JSONTypes = typeof jsonTypes;
export const jsonTypes = {
  array,
  discriminatedUnion,
  enum: enumType,
  instanceOf,
  intersection,
  lazy,
  literal,
  map,
  nativeEnum,
  nullable,
  nullish,
  object,
  optional,
  record,
  ...scalarTypes,
  set,
  tuple,
  union,
};

export class JSONColumn<
  Type extends JSONTypeAny = JSONTypeAny,
> extends ColumnType<Type['type'], typeof Operators.json> {
  dataType = 'jsonb' as const;
  operators = Operators.json;
  data: ColumnData & { schema: Type };

  constructor(
    schemaOrFn: Type | ((j: JSONTypes) => Type) = scalarTypes.unknown() as Type,
  ) {
    super();

    const schema =
      typeof schemaOrFn === 'function' ? schemaOrFn(jsonTypes) : schemaOrFn;
    this.data = { schema };
  }

  toCode(t: string): Code {
    const { schema } = this.data;
    return columnCode(this, t, `${t}.json((t) => ${schema.toCode('t')})`);
  }
}

export class JSONTextColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'json' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.jsonText()`);
  }
}
