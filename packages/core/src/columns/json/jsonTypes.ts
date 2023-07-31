import {
  JSONBoolean,
  JSONNull,
  JSONNumber,
  JSONString,
  JSONUnknown,
} from './scalarTypes';
import { JSONArray } from './array';
import { JSONPrimitive, JSONType } from './jsonType';
import { JSONObject, JSONObjectShape } from './object';
import { JSONLiteral } from './literal';
import {
  JSONDiscriminatedUnion,
  JSONDiscriminatedUnionArg,
} from './discriminatedUnion';
import { JSONEnum } from './enum';
import { JSONIntersection } from './intersection';
import { JSONLazy } from './lazy';
import { EnumLike, JSONNativeEnum } from './nativeEnum';
import { JSONRecord } from './record';
import { JSONTuple, JSONTupleItems } from './tuple';
import { JSONUnion, JSONUnionArgs } from './union';

// The type of all available JSON type constructors.
export type JSONTypes = typeof jsonTypes;

// Object with all available JSON type constructors, is passed as an argument into `json(t => ...)` column.
export const jsonTypes = {
  unknown: () => new JSONUnknown(),
  boolean: () => new JSONBoolean(),
  null: () => new JSONNull(),
  number: () => new JSONNumber(),
  string: () => new JSONString(),
  array: <T extends JSONType>(item: T) => new JSONArray(item),
  object: <Shape extends JSONObjectShape>(shape: Shape) =>
    new JSONObject(shape),
  literal: <T extends JSONPrimitive>(value: T) => new JSONLiteral(value),
  discriminatedUnion: <
    Discriminator extends string,
    Types extends JSONDiscriminatedUnionArg<Discriminator>,
  >(
    discriminator: Discriminator,
    types: Types,
  ) => new JSONDiscriminatedUnion<Discriminator, Types>(discriminator, types),
  enum: <U extends string, T extends [U, ...U[]]>(options: T) =>
    new JSONEnum(options),
  intersection: <Left extends JSONType, Right extends JSONType>(
    left: Left,
    right: Right,
  ) => new JSONIntersection(left, right),
  lazy: <T extends JSONType>(fn: () => T) => new JSONLazy(fn),
  nativeEnum: <T extends EnumLike>(type: T) => new JSONNativeEnum(type),
  record: <Key extends JSONString | JSONNumber, Value extends JSONType>(
    ...args: [value: Value] | [key: Key, value: Value]
  ) => new JSONRecord(...args),
  tuple: <
    T extends JSONTupleItems,
    Rest extends JSONType | undefined = undefined,
  >(
    items: T,
    rest?: Rest,
  ) => new JSONTuple(items, rest),
  union: <T extends JSONUnionArgs>(...types: T) => new JSONUnion(...types),
};
