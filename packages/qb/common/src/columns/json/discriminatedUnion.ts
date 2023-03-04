import { constructType, JSONType, Primitive, toCode } from './typeBase';
import { JSONObject, JSONObjectShape } from './object';
import { JSONLiteral } from './literal';
import { singleQuote } from '../../utils';

export interface JSONDiscriminatedUnion<
  Discriminator extends string,
  DiscriminatorValue extends Primitive,
  Option extends JSONDiscriminatedObject<Discriminator, DiscriminatorValue>,
> extends JSONType<Option['type'], 'discriminatedUnion'> {
  discriminator: Discriminator;
  discriminatorValue: DiscriminatorValue;
  options: Map<DiscriminatorValue, Option>;
  _option: Option;
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

export type JSONDiscriminatedObject<
  Discriminator extends string,
  DiscriminatorValue extends Primitive,
> = JSONObject<
  { [K in Discriminator]: JSONLiteral<DiscriminatorValue> } & JSONObjectShape,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

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
): JSONDiscriminatedUnion<Discriminator, DiscriminatorValue, Types[number]> => {
  const optionsMap: Map<DiscriminatorValue, Types[number]> = new Map();

  options.forEach((option) => {
    const discriminatorValue = option.shape[discriminator].value;
    optionsMap.set(discriminatorValue as DiscriminatorValue, option);
  });

  return constructType<
    JSONDiscriminatedUnion<Discriminator, DiscriminatorValue, Types[number]>
  >({
    dataType: 'discriminatedUnion',
    discriminator,
    discriminatorValue: undefined as unknown as DiscriminatorValue,
    options: optionsMap,
    _option: undefined as unknown as Types[number],
    toCode(
      this: JSONDiscriminatedUnion<
        string,
        Primitive,
        JSONDiscriminatedObject<Discriminator, DiscriminatorValue>
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
      this: JSONDiscriminatedUnion<
        Discriminator,
        DiscriminatorValue,
        Types[number]
      >,
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
