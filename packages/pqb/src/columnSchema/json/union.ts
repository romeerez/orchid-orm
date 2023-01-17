import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';
import { toArray } from '../../utils';

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
      return toCode(
        this,
        t,
        this.types.flatMap((type, i) => {
          const item = [...toArray(type.toCode(t))];
          if (i < last) {
            item.push(`${i > 0 ? ')' : ''}.or(`);
          } else {
            item.push(')');
          }
          return item;
        }),
      );
    },
  });
};
