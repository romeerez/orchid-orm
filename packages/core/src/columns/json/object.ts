import { JSONDeepPartial, JSONOptional, JSONType } from './jsonType';
import { addCode, Code } from '../code';
import { ErrorMessage, setDataValue } from '../commonMethods';
import { omit, pick, quoteObjectKey, singleQuote } from '../../utils';
import { jsonTypeToCode } from './code';

// base type for JSON object shape
export type JSONObjectShape = Record<string, JSONType>;

// JSON object mode
// `strip` is a default, remove unknown properties
// `passthrough` will preserve unknown properties
// `strict` will throw error when meet unknown properties
export type UnknownKeysParam = 'passthrough' | 'strict' | 'strip';

// make all object properties to be optional
type FullyPartial<T extends JSONObjectShape> = {
  [K in keyof T]: JSONOptional<T[K]>;
};

// make the given object properties to be optional
type PartiallyPartial<T extends JSONObjectShape, P extends keyof T> = {
  [K in keyof T]: K extends P ? JSONOptional<T[K]> : T[K];
};

// union of object keys for the values that can be undefined
type OptionalKeys<T extends JSONObjectShape> = {
  [K in keyof T]: undefined extends T[K]['type'] ? K : never;
}[keyof T];

// union of object keys for the values that can not be undefined
type RequiredKeys<T extends JSONObjectShape> = {
  [K in keyof T]: undefined extends T[K]['type'] ? never : K;
}[keyof T];

// Output type for the object, not taking `catchAll` into account.
type BaseObjectOutput<Shape extends JSONObjectShape> = {
  [K in OptionalKeys<Shape>]?: Shape[K]['type'];
} & {
  [K in RequiredKeys<Shape>]: Shape[K]['type'];
};

// Output type for the object.
// If `catchAll` is provided, it combines strict object type with a record of `catchAll` values.
export type JSONObjectOutput<
  Shape extends JSONObjectShape,
  CatchAll extends JSONType,
> = JSONType extends CatchAll
  ? BaseObjectOutput<Shape>
  : BaseObjectOutput<Shape> & Record<string, CatchAll['type']>;

// JSON object data to store object parameters
export type JSONObjectData<
  Shape extends JSONObjectShape,
  UnknownKeys extends UnknownKeysParam,
  CatchAll extends JSONType,
> = {
  // Object shape: values are JSON types.
  shape: Shape;
  // Object mode for what to do with unknown keys. Stripping them is a default.
  unknownKeys: UnknownKeys;
  // Optionally, set the type to validate all unknown values with a given type.
  catchAll: CatchAll;
};

// Merge JSON object with another object shape
type ObjectMerge<
  Shape extends JSONObjectShape,
  S extends JSONObjectShape,
  UnknownKeys extends UnknownKeysParam,
  CatchAll extends JSONType,
> = JSONObject<
  {
    [K in keyof Shape | keyof S]: K extends keyof S
      ? S[K]
      : K extends keyof Shape
      ? Shape[K]
      : never;
  },
  UnknownKeys,
  CatchAll
>;

// JSON object type
export class JSONObject<
  Shape extends JSONObjectShape,
  UnknownKeys extends UnknownKeysParam = 'strip',
  CatchAll extends JSONType = JSONType,
> extends JSONType<
  JSONObjectOutput<Shape, CatchAll>,
  JSONObjectData<Shape, UnknownKeys, CatchAll>
> {
  declare kind: 'object';

  constructor(shape: Shape) {
    super();
    this.data.shape = shape;
  }

  toCode(t: string): Code {
    const { shape, unknownKeys, catchAll, errors } = this.data;

    const code: Code[] = [`${t}.object({`];

    for (const key in shape) {
      const line: Code[] = [];
      addCode(line, `${quoteObjectKey(key)}: `);
      addCode(line, shape[key].toCode(t));
      addCode(line, ',');
      code.push(line);
    }

    addCode(code, '})');

    if (unknownKeys === 'passthrough') {
      addCode(code, '.passthrough()');
    } else if (unknownKeys === 'strict') {
      const error = errors?.strict;
      addCode(code, `.strict(${error ? singleQuote(error) : ''})`);
    }

    if (catchAll) {
      addCode(code, `.catchAll(`);
      addCode(code, catchAll.toCode(t));
      addCode(code, ')');
    }

    return jsonTypeToCode(this, t, code);
  }

  /**
   * Extend object by providing an additional set of key-values.
   * Existing object values will be overwritten with the given ones if their keys match.
   *
   * @param add - object with new key-values.
   */
  extend<S extends JSONObjectShape>(
    add: S,
  ): ObjectMerge<Shape, S, UnknownKeys, CatchAll> {
    return setDataValue(this, 'shape', {
      ...this.data.shape,
      ...add,
    }) as unknown as ObjectMerge<Shape, S, UnknownKeys, CatchAll>;
  }

  /**
   * Merge object with another object.
   * Existing object values will be overwritten with the given ones if their keys match.
   *
   * @param obj - another JSON object type
   */
  merge<
    S extends JSONObjectShape,
    U extends UnknownKeysParam,
    C extends JSONType,
  >(obj: JSONObject<S, U, C>): ObjectMerge<Shape, S, U, C> {
    const cloned = Object.create(this);
    cloned.data = {
      ...this.data,
      shape: { ...this.data.shape, ...obj.data.shape },
      unknownKeys: obj.data.unknownKeys,
      catchAll: obj.data.catchAll,
    };
    return cloned;
  }

  /**
   * Create a new JSON object by picking some key-values from the current one.
   *
   * @param keys - keys of the object to pick
   */
  pick<K extends keyof Shape>(
    ...keys: K[]
  ): JSONObject<Pick<Shape, K>, UnknownKeys, CatchAll> {
    return setDataValue(
      this,
      'shape',
      pick(this.data.shape, keys),
    ) as unknown as JSONObject<Pick<Shape, K>, UnknownKeys, CatchAll>;
  }

  /**
   * Create a new JSON object by omitting some key-values from the current one.
   *
   * @param keys - keys of the object to omit
   */
  omit<K extends keyof Shape>(
    ...keys: K[]
  ): JSONObject<Omit<Shape, K>, UnknownKeys, CatchAll> {
    return setDataValue(
      this,
      'shape',
      omit(this.data.shape, keys),
    ) as unknown as JSONObject<Omit<Shape, K>, UnknownKeys, CatchAll>;
  }

  /**
   * Make the object fully partial.
   */
  partial(): JSONObject<FullyPartial<Shape>, UnknownKeys, CatchAll>;
  /**
   * Mark some keys of the object to be optional.
   * @param keys - keys of the object to make optional.
   */
  partial<Keys extends keyof Shape>(
    ...keys: Keys[]
  ): JSONObject<PartiallyPartial<Shape, Keys>, UnknownKeys, CatchAll>;
  partial(...keys: string[]) {
    const partial: JSONObjectShape = { ...this.data.shape };

    if (keys.length) {
      for (const key of keys) {
        partial[key] = partial[key].optional();
      }
    } else {
      for (const key in partial) {
        partial[key] = partial[key].optional();
      }
    }

    return setDataValue(this, 'shape', partial) as unknown as
      | JSONObject<FullyPartial<Shape>, UnknownKeys, CatchAll>
      | JSONObject<PartiallyPartial<Shape, string>, UnknownKeys, CatchAll>;
  }

  // Make this object fully partial, and make all nested objects partial recursively.
  deepPartial(): JSONObject<{
    [K in keyof Shape]: JSONOptional<JSONDeepPartial<Shape[K]>>;
  }> {
    const { shape } = this.data;
    const newShape: JSONObjectShape = {};

    for (const key in shape) {
      newShape[key] = shape[key].deepPartial().optional();
    }

    return setDataValue(this, 'shape', newShape) as unknown as JSONObject<{
      [K in keyof Shape]: JSONOptional<JSONDeepPartial<Shape[K]>>;
    }>;
  }

  // Set the validation mode to `passthrough`: all unknown object key-values will be preserved.
  passthrough(): JSONObject<Shape, 'passthrough', CatchAll> {
    return setDataValue(this, 'unknownKeys', 'passthrough') as JSONObject<
      Shape,
      'passthrough',
      CatchAll
    >;
  }

  /**
   * Set the validation mode to `strict`: validation will fail if there is an unknown key.
   *
   * @param errorMessage - string or an object with an error message
   */
  strict(errorMessage?: ErrorMessage): JSONObject<Shape, 'strict', CatchAll> {
    const cloned = Object.create(this);
    cloned.data.unknownKeys = 'strict';
    cloned.data.errors = {
      ...this.data.errors,
      strict:
        typeof errorMessage === 'string' ? errorMessage : errorMessage?.message,
    };
    return cloned;
  }

  // Set the validation mode to `strip`: strip all unknown keys, this is a default.
  strip(): JSONObject<Shape, 'strip', CatchAll> {
    return setDataValue(this, 'unknownKeys', 'strip') as JSONObject<
      Shape,
      'strip',
      CatchAll
    >;
  }

  // Set the type to validate all unknown keys with.
  catchAll<C extends JSONType>(type: C): JSONObject<Shape, UnknownKeys, C> {
    return setDataValue(this, 'catchAll', type) as unknown as JSONObject<
      Shape,
      UnknownKeys,
      C
    >;
  }
}
