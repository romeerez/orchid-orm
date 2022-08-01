import { ColumnType } from './columnType';
import { Operators } from '../operators';
import { scalarTypes } from './json/scalarTypes';
import { array } from './json/array';
import { discriminatedUnion } from './json/discriminatedUnion';
import { enumType } from './json/enum';
import { instanceOf } from './json/instanceOf';
import { intersection } from './json/intersection';
import { lazy } from './json/lazy';
import { literal } from './json/literal';
import { map } from './json/map';
import { nativeEnum } from './json/nativeEnum';
import { nullable } from './json/nullable';
import { nullish } from './json/nullish';
import { object } from './json/object';
import { optional } from './json/optional';
import { record } from './json/record';
import { set } from './json/set';
import { tuple } from './json/tuple';
import { union } from './json/union';
import { JSONTypeAny } from './json/typeBase';

export type JSONTypes = typeof jsonTypes;
const jsonTypes = {
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

export class JSONColumn<Type extends JSONTypeAny> extends ColumnType<
  Type['type'],
  typeof Operators.json
> {
  dataType = 'jsonb' as const;
  operators = Operators.json;
  data: { schema: Type };

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
