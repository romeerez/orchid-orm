import { JSONDeepPartial, JSONType } from './jsonType';
import { addCode, Code } from '../code';
import { jsonTypeToCode } from './code';

// JSON union type arguments: at least 2 types are required.
export type JSONUnionArgs = [JSONType, JSONType, ...JSONType[]];

// Map JSON union types into deep partial types.
export type JSONUnionDeepPartialArgs<T extends JSONUnionArgs> = {
  [K in keyof T]: JSONDeepPartial<T[K]>;
};

// JSON union types: makes a union of at least 2 JSON types.
export class JSONUnion<T extends JSONUnionArgs> extends JSONType<
  T[number]['type'],
  { types: T }
> {
  declare kind: 'union';

  constructor(...types: T) {
    super();
    this.data.types = types;
  }

  toCode(t: string): Code {
    const last = this.data.types.length - 1;

    const code: Code = [];
    this.data.types.forEach((type, i) => {
      addCode(code, type.toCode(t));
      if (i < last) {
        addCode(code, `${i > 0 ? ')' : ''}.or(`);
      } else {
        addCode(code, ')');
      }
    });

    return jsonTypeToCode(this, t, code);
  }

  deepPartial(): Omit<
    JSONUnion<
      JSONUnionDeepPartialArgs<T> extends JSONUnionArgs
        ? JSONUnionDeepPartialArgs<T>
        : never
    >,
    'deepPartial'
  > & { deepPartial(): JSONType } {
    return new JSONUnion(
      ...(this.data.types.map((type) => type.deepPartial()) as JSONUnionArgs),
    ) as JSONUnion<
      JSONUnionDeepPartialArgs<T> extends JSONUnionArgs
        ? JSONUnionDeepPartialArgs<T>
        : never
    >;
  }
}

JSONType.prototype.or = function (...types) {
  return new JSONUnion(this, ...types);
};
