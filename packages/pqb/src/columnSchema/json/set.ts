import {
  constructType,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';
import { SetMethods, setMethods } from '../commonMethods';
import { toArray } from '../../utils';

export interface JSONSet<Value extends JSONTypeAny>
  extends JSONType<Set<Value['type']>, 'set'>,
    SetMethods {
  data: JSONTypeData & {
    min?: number;
    max?: number;
    size?: number;
  };
  valueType: Value;
  deepPartial(): JSONSet<ReturnType<Value['deepPartial']>>;
}

export const set = <Value extends JSONTypeAny>(valueType: Value) => {
  return constructType<JSONSet<Value>>({
    dataType: 'set',
    valueType,
    toCode(this: JSONSet<Value>, t: string) {
      let append = ')';

      const { min, max, size, isNonEmpty } = this.data;

      if (min !== undefined && (!isNonEmpty || (isNonEmpty && min !== 1)))
        append += `.min(${min})`;

      if (max !== undefined) append += `.max(${max})`;

      if (size !== undefined) append += `.size(${size})`;

      return toCode(this, t, [
        `${t}.set(`,
        ...toArray(this.valueType.toCode(t)),
        append,
      ]);
    },
    deepPartial(this: JSONSet<Value>) {
      return {
        ...this,
        valueType: this.valueType.deepPartial(),
      };
    },
    ...setMethods,
  });
};
