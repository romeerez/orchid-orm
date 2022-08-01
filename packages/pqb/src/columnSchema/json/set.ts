import { constructType, JSONType, JSONTypeAny, JSONTypeData } from './typeBase';
import { ArrayMethods, arrayMethods } from '../commonMethods';

export interface JSONSet<Value extends JSONTypeAny>
  extends JSONType<Set<Value['type']>, 'set'>,
    ArrayMethods {
  data: JSONTypeData & {
    min?: number;
    max?: number;
    length?: number;
  };
  valueType: Value;
  deepPartial(): JSONSet<ReturnType<Value['deepPartial']>>;
  nonEmpty(this: JSONSet<Value>): JSONSet<Value> & { data: { min: 1 } };
}

export const set = <Value extends JSONTypeAny>(valueType: Value) => {
  return constructType<JSONSet<Value>>({
    dataType: 'set',
    valueType,
    deepPartial(this: JSONSet<Value>) {
      return {
        ...this,
        valueType: this.valueType.deepPartial(),
      };
    },
    nonEmpty(this: JSONSet<Value>) {
      return this.min(1) as unknown as JSONSet<Value> & {
        data: { min: 1 };
      };
    },
    ...arrayMethods,
  });
};
