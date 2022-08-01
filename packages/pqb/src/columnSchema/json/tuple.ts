import { constructType, DeepPartial, JSONType, JSONTypeAny } from './typeBase';

export interface JSONTuple<
  T extends JSONTupleItems | [] = JSONTupleItems,
  Rest extends JSONTypeAny | null = null,
> extends JSONType<OutputTypeOfTupleWithRest<T, Rest>, 'tuple'> {
  items: T;
  deepPartial(): {
    [k in keyof T]: T[k] extends JSONTypeAny ? DeepPartial<T[k]> : never;
  } extends infer PI
    ? PI extends JSONTupleItems
      ? JSONTuple<PI>
      : never
    : never;
}

export type JSONTupleItems = [JSONTypeAny, ...JSONTypeAny[]];
export type AssertArray<T> = T extends unknown[] ? T : never;
export type OutputTypeOfTuple<T extends JSONTupleItems | []> = AssertArray<{
  [k in keyof T]: T[k] extends JSONTypeAny ? T[k]['type'] : never;
}>;
export type OutputTypeOfTupleWithRest<
  T extends JSONTupleItems | [],
  Rest extends JSONTypeAny | null = null,
> = Rest extends JSONTypeAny
  ? [...OutputTypeOfTuple<T>, ...Rest['type'][]]
  : OutputTypeOfTuple<T>;

export const tuple = <T extends JSONTupleItems | []>(items: T) => {
  return constructType<JSONTuple<T>>({
    dataType: 'tuple',
    items,
    deepPartial(this: JSONTuple<T>) {
      return {
        ...this,
        items: this.items.map((item) => item.deepPartial()),
      };
    },
  });
};
