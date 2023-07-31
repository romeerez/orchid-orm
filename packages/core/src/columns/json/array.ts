import { JSONDeepPartial, JSONType } from './jsonType';
import { addCode, arrayDataToCode, Code } from '../code';
import {
  ArrayTypeMethods,
  ArrayTypeData,
  arrayTypeMethods,
} from '../commonMethods';
import { assignMethodsToClass, toArray } from '../../utils';
import { jsonTypeToCode } from './code';

// 'many' is when elements count does not matter, 'atLeastOne' to require at least one element
export type ArrayCardinality = 'many' | 'atLeastOne';

// get output type of array JSON type
type ArrayOutputType<
  T extends JSONType,
  Cardinality extends ArrayCardinality = 'many',
> = Cardinality extends 'atLeastOne'
  ? [T['type'], ...T['type'][]]
  : T['type'][];

// JSON array extends JSONType and the same array type methods as the array column
export interface JSONArray<
  T extends JSONType,
  Cardinality extends ArrayCardinality = 'many',
> extends JSONType<ArrayOutputType<T, Cardinality>, ArrayTypeData<T>>,
    ArrayTypeMethods {}

// JSON array type: wraps any other type into array
export class JSONArray<
  T extends JSONType,
  Cardinality extends ArrayCardinality = 'many',
> extends JSONType<ArrayOutputType<T, Cardinality>, ArrayTypeData<T>> {
  declare kind: 'array';

  constructor(item: T) {
    super();
    this.data.item = item;
  }

  toCode(t: string): Code {
    const code = [...toArray(this.data.item.toCode(t))];
    addCode(code, `.array()${arrayDataToCode(this.data)}`);
    return jsonTypeToCode(this, t, code);
  }

  deepPartial(): JSONArray<JSONDeepPartial<T>, Cardinality> {
    const cloned = Object.create(this);
    cloned.data = {
      ...this.data,
      item: this.data.item.deepPartial(),
      isDeepPartial: true,
    };
    return cloned;
  }
}

assignMethodsToClass(JSONArray, arrayTypeMethods);

// Make `array` method available on any JSON type.
JSONType.prototype.array = function () {
  return new JSONArray(this);
};
