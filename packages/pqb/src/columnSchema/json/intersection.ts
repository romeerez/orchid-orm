import { constructType, JSONType, JSONTypeAny } from './typeBase';

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
  });
};
