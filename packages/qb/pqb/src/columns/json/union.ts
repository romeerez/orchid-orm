import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';
import { addCode } from '../code';
import { Code } from '../../../../common/src/columns/code';

export interface JSONUnion<
  T extends [JSONTypeAny, JSONTypeAny, ...JSONTypeAny[]],
> extends JSONType<T[number]['type'], 'union'> {
  types: T;
}

export const union = <T extends [JSONTypeAny, JSONTypeAny, ...JSONTypeAny[]]>(
  types: T,
): JSONUnion<T> => {
  return constructType<JSONUnion<T>>({
    dataType: 'union',
    types,
    toCode(this: JSONUnion<T>, t: string) {
      const last = this.types.length - 1;

      const code: Code = [];
      this.types.forEach((type, i) => {
        addCode(code, type.toCode(t));
        if (i < last) {
          addCode(code, `${i > 0 ? ')' : ''}.or(`);
        } else {
          addCode(code, ')');
        }
        return code;
      });

      return toCode(this, t, code);
    },
  });
};
