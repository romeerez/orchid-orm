import {
  constructType,
  DeepPartial,
  JSONType,
  JSONTypeAny,
  toCode,
} from './typeBase';

export interface JSONTuple<
  T extends JSONTupleItems | [] = JSONTupleItems,
  Rest extends JSONTypeAny | null = null,
> extends JSONType<OutputTypeOfTupleWithRest<T, Rest>, 'tuple'> {
  items: T;
  restType: Rest;
  rest<Rest extends JSONTypeAny | null>(rest: Rest): JSONTuple<T, Rest>;
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

export const tuple = <
  T extends JSONTupleItems | [],
  Rest extends JSONTypeAny | null = null,
>(
  items: T,
  rest: Rest = null as Rest,
) => {
  return constructType<JSONTuple<T, Rest>>({
    dataType: 'tuple',
    items,
    restType: rest,
    toCode(this: JSONTuple<T, Rest>, t: string) {
      return toCode(
        this,
        t,
        `${t}.tuple([${this.items.map((item) => item.toCode(t)).join(', ')}]${
          this.restType ? `, ${this.restType.toCode(t)}` : ''
        })`,
      );
    },
    rest<Rest extends JSONTypeAny | null>(rest: Rest): JSONTuple<T, Rest> {
      return {
        ...this,
        restType: rest,
      } as unknown as JSONTuple<T, Rest>;
    },
    deepPartial(this: JSONTuple<T>) {
      return {
        ...this,
        items: this.items.map((item) => item.deepPartial()),
      };
    },
  });
};
