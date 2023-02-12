import {
  constructType,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';
import { SetMethods, setMethods } from '../commonMethods';
import { addCode } from '../code';
import { Code } from '../../../../common/src/columns/code';

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
      const code: Code[] = [`${t}.set(`];
      addCode(code, this.valueType.toCode(t));
      addCode(code, ')');

      const { min, max, size, isNonEmpty } = this.data;

      if (min !== undefined && (!isNonEmpty || (isNonEmpty && min !== 1)))
        addCode(code, `.min(${min})`);

      if (max !== undefined) addCode(code, `.max(${max})`);

      if (size !== undefined) addCode(code, `.size(${size})`);

      return toCode(this, t, code);
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
