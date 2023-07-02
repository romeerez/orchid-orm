import { setDataValue } from '../commonMethods';
import { ColumnChain, ValidationContext } from '../columnType';
import { emptyArray, EmptyObject } from '../../utils';
import { Code } from '../code';
import type { JSONIntersection } from './intersection';
import type { JSONUnion } from './union';
import type { JSONArray } from './array';

// Primitive type to use for a JSON literal.
export type JSONPrimitive = string | number | boolean | null;

// Add `undefined` to the output type and add `optional: true` to the `data` type.
export type JSONOptional<T extends JSONType> = {
  [K in keyof T]: K extends 'type'
    ? T['type'] | undefined
    : K extends 'data'
    ? T['data'] & { optional: true }
    : T[K];
};

// Remove `undefined` from the output type and remove `optional: true` from the `data` type.
export type JSONRequired<T extends JSONType> = {
  [K in keyof T]: K extends 'type'
    ? Exclude<T['type'], undefined>
    : K extends 'data'
    ? Omit<T['data'], 'optional'> & { optional?: true }
    : T[K];
};

// Add `null` to the output type and add `nullable: true` to the `data` type.
export type JSONNullable<T extends JSONType> = {
  [K in keyof T]: K extends 'type'
    ? T['type'] | null
    : K extends 'data'
    ? T['data'] & { nullable: true }
    : T[K];
};

// Remove `null` from the output type and remove `nullable: true` from the `data` type.
export type JSONNotNullable<T extends JSONType> = {
  [K in keyof T]: K extends 'type'
    ? Exclude<T['type'], null>
    : K extends 'data'
    ? Omit<T['data'], 'nullable'> & { nullable?: true }
    : T[K];
};

// If the JSON type has a custom `deepPartial`, return it's return type. Otherwise, return the type as is.
export type JSONDeepPartial<T extends JSONType> = JSONType extends ReturnType<
  T['deepPartial']
>
  ? T
  : T['deepPartial'] extends (() => infer R extends JSONType)
  ? R
  : never;

// Change the output type of the JSON type.
type JSONTransform<T extends JSONType, Transformed> = {
  [K in keyof T]: K extends 'type' ? Transformed : T[K];
};

// Common data for JSON types.
export type JSONTypeData = {
  // validation chain
  chain?: ColumnChain;
  // can it be null?
  nullable?: true;
  // can it be undefined?
  optional?: true;
  // is `deepPartial` applied? To add `.deepPartial()` to the generated code.
  isDeepPartial?: true;
  // `isNonEmpty` can be used by a string or array type.
  isNonEmpty?: true;
  // default value for the type.
  default?: unknown;
  // Record where key is error kind identified and the value is a custom error message.
  errors?: Record<string, string>;
};

// base type for json types
export abstract class JSONType<
  Type = unknown,
  Data extends Record<string, unknown> = EmptyObject,
> {
  abstract kind: string;

  // output type
  type!: Type;

  // data of the json type
  data = {} as JSONTypeData & Data;

  // generate code for this type
  abstract toCode(t: string): Code;

  // Make the column optional to allow `undefined` value.
  optional<T extends JSONType>(this: T): JSONOptional<T> {
    return setDataValue(this, 'optional', true) as JSONOptional<T>;
  }

  // Make the column required to disallow `undefined` value.
  required<T extends JSONType>(this: T): JSONRequired<T> {
    return setDataValue(this, 'optional', undefined) as JSONRequired<T>;
  }

  // Make the column nullable to allow `null` value.
  nullable<T extends JSONType>(this: T): JSONNullable<T> {
    return setDataValue(this, 'nullable', true) as JSONNullable<T>;
  }

  // Make the column not nullable to disallow `null` value.
  notNullable<T extends JSONType>(this: T): JSONNotNullable<T> {
    return setDataValue(this, 'nullable', undefined) as JSONNotNullable<T>;
  }

  // `nullish` column allows `undefined` and `null` values.
  nullish<T extends JSONType>(this: T): JSONNullable<JSONOptional<T>> {
    const type = Object.create(this);
    type.data.optional = true;
    type.data.nullable = true;
    return type;
  }

  // Call `notNullish` to disallow `undefined` and `null` values.
  notNullish<T extends JSONType>(this: T): JSONNotNullable<JSONRequired<T>> {
    const type = Object.create(this);
    delete type.data.optional;
    delete type.data.nullable;
    return type;
  }

  // mark all nested objects as partial
  deepPartial(): JSONType {
    return this;
  }

  // Specify a function to transform a value during a validation.
  transform<T extends JSONType, Transformed>(
    this: T,
    fn: (input: T['type'], ctx: ValidationContext) => Transformed,
  ): JSONTransform<T, Transformed> {
    return setDataValue(this, 'chain', [
      ...(this.data.chain || emptyArray),
      ['transform', fn],
    ]) as JSONTransform<T, Transformed>;
  }

  // Specify a function to transform a value and use a different type during a validation.
  to<T extends JSONType, ToType extends JSONType>(
    this: T,
    fn: (input: T['type']) => ToType['type'] | undefined,
    type: ToType,
  ): ToType {
    return setDataValue(this, 'chain', [
      ...(this.data.chain || emptyArray),
      ['to', fn, type],
      ...(type.data.chain || emptyArray),
    ]) as unknown as ToType;
  }

  // Specify a function which will return a falsy value if the input is not correct.
  refine<T extends JSONType>(this: T, check: (arg: T['type']) => unknown): T {
    const arr: unknown[] = ['refine', check];
    const type = setDataValue(this, 'chain', [
      ...(this.data.chain || emptyArray),
      arr,
    ]);
    arr.push(type);
    return type as T;
  }

  // Specify a function to validate values and can add multiple issues.
  superRefine<T extends JSONType>(
    this: T,
    check: (arg: T['type'], ctx: ValidationContext) => unknown,
  ): T {
    return setDataValue(this, 'chain', [
      ...(this.data.chain || emptyArray),
      ['superRefine', check],
    ]) as T;
  }

  // Intersect this type with another: same as `left & right` in TypeScript.
  declare and: <Left extends JSONType, Right extends JSONType>(
    this: Left,
    type: Right,
  ) => JSONIntersection<Left, Right>;

  // Union of this type and others: same as `left | right` in TypeScript.
  declare or: <T extends JSONType, U extends JSONType, Rest extends JSONType[]>(
    this: T,
    ...types: [U, ...Rest]
  ) => JSONUnion<[T, U, ...Rest]>;

  // Default value to set during a validation.
  default<T extends JSONType>(
    this: T,
    value: T['type'] | (() => T['type']),
  ): JSONNotNullable<JSONRequired<T>> {
    return setDataValue(this, 'default', value) as JSONNotNullable<
      JSONRequired<T>
    >;
  }

  // Turn this type into array of such types.
  declare array: <T extends JSONType>(this: T) => JSONArray<T>;

  // Set error messages:
  // `required` is for the case when the value is undefined;
  // `invalidType` is for the case when one type was expected but a different one was provided.
  errors<T extends JSONType>(
    this: T,
    errorMessages: { [K in 'required' | 'invalidType']?: string },
  ): T {
    return setDataValue(this, 'errors', {
      ...this.data.errors,
      ...errorMessages,
    }) as T;
  }
}
