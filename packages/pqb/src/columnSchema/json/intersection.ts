import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';

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
      return toCode(this, t, [
        this.left.toCode(t),
        '.and(',
        this.right.toCode(t),
        ')',
      ]);
    },
  });
};
