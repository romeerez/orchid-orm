import { constructType, JSONType, Primitive, toCode } from './typeBase';
import { JSONObject, JSONObjectShape } from './object';
import { JSONLiteral } from './literal';
import { singleQuote } from '../../utils';

// JSON type for the union of objects, where object type is determined by a specific key
export interface JSONDiscriminatedUnion<
  Discriminator extends string,
  DiscriminatorValue extends Primitive,
  Options extends JSONDiscriminatedObject<Discriminator, DiscriminatorValue>[],
> extends JSONType<Options[number]['type'], 'discriminatedUnion'> {
  discriminator: Discriminator;
  discriminatorValue: DiscriminatorValue;
  options: Map<DiscriminatorValue, Options[number]>;
  _options: Options;
  // WON'T DO: gave up on deepPartial type
  // deepPartial(): JSONDiscriminatedUnion<
  //   Discriminator,
  //   {
  //     [Index in keyof Types]: {
  //       [K in keyof Types[Index]['shape']]: K extends Discriminator
  //         ? Types[Index]['shape'][K]
  //         : JSONOptional<Types[Index]['shape'][K]>;
  //     } extends JSONObject<Record<Discriminator, JSONLiteral<Primitive>>>
  //       ? JSONObject<
  //           {
  //             [K in keyof Types[Index]['shape']]: K extends Discriminator
  //               ? Types[Index]['shape'][K]
  //               : JSONOptional<Types[Index]['shape'][K]>;
  //           },
  //           Types[Index]['unknownKeys'],
  //           Types[Index]['catchAllType']
  //         >
  //       : Types[Index];
  //   } & {
  //     length: Types['length'];
  //   }
  // >;
}

// type for a single object in a discriminated union
export type JSONDiscriminatedObject<
  Discriminator extends string,
  DiscriminatorValue extends Primitive,
> = JSONObject<
  { [K in Discriminator]: JSONLiteral<DiscriminatorValue> } & JSONObjectShape,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

// Discriminated union constructor
export const discriminatedUnion = <
  Discriminator extends string,
  DiscriminatorValue extends Primitive,
  Types extends [
    JSONDiscriminatedObject<Discriminator, DiscriminatorValue>,
    JSONDiscriminatedObject<Discriminator, DiscriminatorValue>,
    ...JSONDiscriminatedObject<Discriminator, DiscriminatorValue>[],
  ],
>(
  discriminator: Discriminator,
  options: Types,
): JSONDiscriminatedUnion<Discriminator, DiscriminatorValue, Types> => {
  const optionsMap: Map<DiscriminatorValue, Types[number]> = new Map();

  options.forEach((option) => {
    const discriminatorValue = option.shape[discriminator].value;
    optionsMap.set(discriminatorValue as DiscriminatorValue, option);
  });

  return constructType<
    JSONDiscriminatedUnion<Discriminator, DiscriminatorValue, Types>
  >({
    dataType: 'discriminatedUnion',
    discriminator,
    discriminatorValue: undefined as unknown as DiscriminatorValue,
    options: optionsMap,
    _options: undefined as unknown as Types,
    toCode(
      this: JSONDiscriminatedUnion<
        string,
        Primitive,
        JSONDiscriminatedObject<Discriminator, DiscriminatorValue>[]
      >,
      t: string,
    ) {
      return toCode(this, t, [
        `${t}.discriminatedUnion(${singleQuote(this.discriminator)}, [`,
        options.flatMap((option) => option.toCode(t)),
        '])',
      ]);
    },
    deepPartial(
      this: JSONDiscriminatedUnion<Discriminator, DiscriminatorValue, Types>,
    ) {
      const newOptionsMap: Map<DiscriminatorValue, Types[number]> = new Map();

      optionsMap.forEach((option, key) => {
        const partial =
          option.deepPartial() as unknown as JSONDiscriminatedObject<
            Discriminator,
            DiscriminatorValue
          >;
        partial.shape[discriminator] = option.shape[discriminator];
        newOptionsMap.set(key, partial);
      });

      return {
        ...this,
        options: newOptionsMap,
      };
    },
  });
};
