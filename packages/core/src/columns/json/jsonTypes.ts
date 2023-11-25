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
export type JSONTypes = {
  unknown(): JSONUnknown;
  boolean(): JSONBoolean;
  null(): JSONNull;
  number<T extends number = number>(): JSONNumber<T>;
  string<T extends string = string>(): JSONString<T>;
  array<T extends JSONType>(item: T): JSONArray<T, 'many'>;
  object<Shape extends JSONObjectShape>(shape: Shape): JSONObject<Shape>;
  literal<T extends JSONPrimitive>(value: T): JSONLiteral<T>;
  discriminatedUnion<
    Discriminator extends string,
    Types extends JSONDiscriminatedUnionArg<Discriminator>,
  >(
    discriminator: Discriminator,
    types: Types,
  ): JSONDiscriminatedUnion<Discriminator, Types>;
  enum<U extends string, T extends [U, ...U[]]>(
    options: T,
  ): JSONEnum<string, T>;
  intersection<Left extends JSONType, Right extends JSONType>(
    left: Left,
    right: Right,
  ): JSONIntersection<Left, Right>;
  /**
   * You can define a recursive schema, but because of a limitation of TypeScript, their type can't be statically inferred. Instead, you'll need to define the type definition manually, and provide it as a "type hint".
   *
   * ```ts
   * import { JSONType, jsonTypes as t } from 'orchid-orm';
   *
   * interface Category {
   *   name: string;
   *   subCategories: Category[];
   * }
   *
   * const Category: JSONType<Category> = t.lazy(() =>
   *   t.object({
   *     name: t.string(),
   *     subCategories: t.array(Category),
   *   }),
   * );
   *
   * export class Table extends BaseTable {
   *   readonly table = 'table';
   *   columns = this.setColumns((t) => ({
   *     data: t.json((t) =>
   *       t.object({
   *         name: t.string(),
   *         category: Category,
   *       }),
   *     ),
   *   }));
   * }
   * ```
   *
   * @param fn - function to construct json types lazily
   */
  lazy<T extends JSONType>(fn: () => T): JSONLazy<T>;
  nativeEnum<T extends EnumLike>(type: T): JSONNativeEnum<T>;
  record<
    Key extends JSONString<string> | JSONNumber<number>,
    Value extends JSONType,
  >(
    ...args: [value: Value] | [key: Key, value: Value]
  ): JSONRecord<Key, Value>;
  tuple<
    T extends JSONTupleItems,
    Rest extends JSONType | undefined = undefined,
  >(
    items: T,
    rest?: Rest | undefined,
  ): JSONTuple<T, Rest>;
  union<T extends JSONUnionArgs>(...types: T): JSONUnion<T>;
};

// Object with all available JSON type constructors, is passed as an argument into `json(t => ...)` column.
export const jsonTypes: JSONTypes = {
  unknown: () => new JSONUnknown(),
  boolean: () => new JSONBoolean(),
  null: () => new JSONNull(),
  number: () => new JSONNumber(),
  string: () => new JSONString(),
  array: (item) => new JSONArray(item),
  object: (shape) => new JSONObject(shape),
  literal: (value) => new JSONLiteral(value),
  discriminatedUnion: (discriminator, types) =>
    new JSONDiscriminatedUnion(discriminator, types),
  enum: (options) => new JSONEnum(options),
  intersection: (left, right) => new JSONIntersection(left, right),
  lazy: (fn) => new JSONLazy(fn),
  nativeEnum: (type) => new JSONNativeEnum(type),
  record: (...args) => new JSONRecord(...args),
  tuple: (items, rest) => new JSONTuple(items, rest),
  union: (...types) => new JSONUnion(...types),
};
