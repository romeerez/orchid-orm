import { JSONDeepPartial, JSONType } from './jsonType';
import { jsonTypeToCode } from './code';
import { Code } from '../code';

// Argument type for JSON tuple: requires at least one element.
export type JSONTupleItems = [JSONType, ...JSONType[]];

// Output of the JSON tuple type.
type JSONTupleOutput<T extends JSONTupleItems> = {
  [K in keyof T]: T[K]['type'];
};

// Map JSON tuple items into deep partial items.
type DeepPartialItems<T extends JSONTupleItems> = {
  [K in keyof T]: JSONDeepPartial<T[K]>;
};

// JSON tuple type: at least one element is required, optionally provide a type for the rest elements.
export class JSONTuple<
  T extends JSONTupleItems,
  Rest extends JSONType | undefined = undefined,
> extends JSONType<
  Rest extends JSONType
    ? [...JSONTupleOutput<T>, ...Rest['type'][]]
    : JSONTupleOutput<T>,
  {
    items: T;
    rest: Rest;
  }
> {
  declare kind: 'tuple';

  constructor(items: T, rest?: Rest) {
    super();
    this.data.items = items;
    this.data.rest = rest as Rest;
  }

  toCode(t: string): Code {
    return jsonTypeToCode(
      this,
      t,
      `${t}.tuple([${this.data.items
        .map((type) => type.toCode(t))
        .join(', ')}]${this.data.rest ? `, ${this.data.rest.toCode(t)}` : ''})`,
    );
  }

  deepPartial(): JSONTuple<
    DeepPartialItems<T> extends JSONTupleItems ? DeepPartialItems<T> : never,
    Rest extends JSONType ? JSONDeepPartial<Rest> : undefined
  > {
    return new JSONTuple(
      this.data.items.map((type) => type.deepPartial()) as JSONTupleItems,
      this.data.rest?.deepPartial(),
    ) as JSONTuple<
      DeepPartialItems<T> extends JSONTupleItems ? DeepPartialItems<T> : never,
      Rest extends JSONType ? JSONDeepPartial<Rest> : undefined
    >;
  }
}
