import { ColumnData, ColumnType } from './columnType';
import { Operators } from '../columnsOperators';
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
} from './json/index';

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

  constructor(schemaOrFn: Type | ((j: JSONTypes) => Type)) {
    super();

    const schema =
      typeof schemaOrFn === 'function' ? schemaOrFn(jsonTypes) : schemaOrFn;
    this.data = { schema };
  }
}

export class JSONTextColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'json' as const;
  operators = Operators.text;
}
