import {
  constructType,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';
import { SetMethods, setMethods } from '../commonMethods';
import { addCode, Code, dataOfSetToCode } from '../code';
import { MethodsDataOfSet } from '../columnDataTypes';

export interface JSONSet<Value extends JSONTypeAny>
  extends JSONType<Set<Value['type']>, 'set'>,
    SetMethods {
  data: JSONTypeData & MethodsDataOfSet;
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
      addCode(code, `)${dataOfSetToCode(this.data)}`);
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
