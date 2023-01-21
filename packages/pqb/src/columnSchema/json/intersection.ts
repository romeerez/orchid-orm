import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';
import { addCode } from '../code';
import { toArray } from '../../utils';

export type JSONIntersection<
  Left extends JSONTypeAny,
  Right extends JSONTypeAny,
> = JSONType<Left['type'] & Right['type'], 'intersection'> & {
  left: Left;
  right: Right;
};

export const intersection = <
  Left extends JSONTypeAny,
  Right extends JSONTypeAny,
>(
  left: Left,
  right: Right,
) => {
  return constructType<JSONIntersection<Left, Right>>({
    dataType: 'intersection',
    left,
    right,
    toCode(this: JSONIntersection<Left, Right>, t: string) {
      const code = [...toArray(this.left.toCode(t))];
      addCode(code, '.and(');
      const right = this.right.toCode(t);
      if (typeof right === 'string') {
        addCode(code, right);
      } else {
        code.push(right);
      }
      addCode(code, ')');

      return toCode(this, t, code);
    },
  });
};
