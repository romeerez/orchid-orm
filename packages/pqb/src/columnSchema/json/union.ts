import { constructType, JSONType, JSONTypeAny } from './typeBase';

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
  });
};
