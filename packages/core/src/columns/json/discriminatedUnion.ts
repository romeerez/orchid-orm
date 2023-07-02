import { JSONPrimitive, JSONType } from './jsonType';
import {
  JSONObject,
  JSONObjectOutput,
  JSONObjectShape,
  UnknownKeysParam,
} from './object';
import { jsonTypeToCode } from './code';
import { Code } from '../code';
import { setDataValue } from '../commonMethods';
import { singleQuote } from '../../utils';

// Argument of the discriminated union is a tuple to map it properly later when converting to validation schema.
export type JSONDiscriminatedUnionArg<Discriminator extends string> = [
  JSONDiscriminatedObject<Discriminator>,
  JSONDiscriminatedObject<Discriminator>,
  ...JSONDiscriminatedObject<Discriminator>[],
];

// Object type for the discriminated union.
// It must have a special key with a JSON primitive value to use it to differentiate this object from others.
export type JSONDiscriminatedObject<Discriminator extends string> = JSONObject<
  { [K in Discriminator]: JSONType } & JSONObjectShape,
  UnknownKeysParam
>;

// Mark all nested objects in the discriminated union as partial
type DeepPartial<
  D extends string,
  Types extends JSONDiscriminatedUnionArg<D>,
> = JSONDiscriminatedUnion<
  D,
  {
    [I in keyof Types]: DPObject<D, Types[I]> extends JSONDiscriminatedObject<D>
      ? DPObject<D, Types[I]>
      : never;
  }
>;

// Apply deep partial for a single object of the discriminated union
type DPObject<
  D extends string,
  T extends JSONDiscriminatedObject<D>,
  DP extends JSONObjectShape = ReturnType<T['deepPartial']>['data']['shape'],
  Shape extends JSONObjectShape = {
    [K in keyof DP]: K extends D ? T['data']['shape'][D] : DP[K];
  },
> = {
  [K in keyof T]: K extends 'data'
    ? {
        [K in keyof T['data']]: K extends 'shape' ? Shape : T['data'][K];
      }
    : K extends 'type'
    ? JSONObjectOutput<Shape, T['data']['catchAll']>
    : T[K];
};

// JSON type for the union of objects, where object type is determined by a specific key
export class JSONDiscriminatedUnion<
  Discriminator extends string,
  Types extends JSONDiscriminatedUnionArg<Discriminator>,
> extends JSONType<
  Types[number]['type'],
  {
    discriminator: Discriminator;
    options: Map<JSONPrimitive, Types[number]>;
    types: Types;
  }
> {
  declare kind: 'discriminatedUnion';

  constructor(discriminator: Discriminator, types: Types) {
    super();
    this.data.discriminator = discriminator;
    this.data.types = types;
  }

  toCode(t: string): Code {
    return jsonTypeToCode(this, t, [
      `${t}.discriminatedUnion(${singleQuote(this.data.discriminator)}, [`,
      this.data.types.flatMap((type) => type.toCode(t)),
      '])',
    ]);
  }

  deepPartial(): DeepPartial<Discriminator, Types> {
    return setDataValue(this, 'types', {}) as unknown as DeepPartial<
      Discriminator,
      Types
    >;
  }
}
