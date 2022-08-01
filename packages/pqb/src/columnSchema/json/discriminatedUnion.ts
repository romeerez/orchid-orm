import { constructType, JSONType, Primitive } from './typeBase';
import { JSONObject, JSONObjectShape } from './object';
import { JSONLiteral } from './literal';
import { JSONOptional } from './optional';

export interface JSONDiscriminatedUnion<
  Discriminator extends string,
  Options extends DiscriminatedOptions<Discriminator>,
> extends JSONType<Options[number]['type'], 'discriminatedUnion'> {
  discriminator: Discriminator;
  options: OptionsMap<Discriminator, Options>;
  deepPartial(): JSONDiscriminatedUnion<
    Discriminator,
    {
      [Index in keyof Options]: Options[Index] extends JSONObject<JSONObjectShape>
        ? JSONObject<
            Record<Discriminator, Options[Index]['shape'][Discriminator]> & {
              [K in keyof Options[Index]['shape']]: JSONOptional<
                Options[Index]['shape'][K]
              >;
            },
            Options[Index]['unknownKeys'],
            Options[Index]['catchAllType']
          >
        : Options[Index];
    } & {
      length: Options['length'];
    }
  >;
}

type JSONDiscriminatedObject<Discriminator extends string> = JSONObject<
  Record<Discriminator, JSONLiteral<Primitive>>
>;

type DiscriminatedOptions<Discriminator extends string> = readonly [
  JSONDiscriminatedObject<Discriminator>,
  JSONDiscriminatedObject<Discriminator>,
  ...JSONDiscriminatedObject<Discriminator>[],
];

type OptionsMap<
  Discriminator extends string,
  Options extends DiscriminatedOptions<Discriminator>,
> = Map<Options[number]['shape'][Discriminator]['value'], Options[number]>;

export const discriminatedUnion = <
  Discriminator extends string,
  Options extends DiscriminatedOptions<Discriminator>,
>(
  discriminator: Discriminator,
  options: Options,
) => {
  const optionsMap: OptionsMap<
    Discriminator,
    DiscriminatedOptions<Discriminator>
  > = new Map();

  options.forEach((option) => {
    const discriminatorValue = option.shape[discriminator].value;
    optionsMap.set(discriminatorValue, option);
  });

  return constructType<JSONDiscriminatedUnion<Discriminator, Options>>({
    dataType: 'discriminatedUnion',
    discriminator,
    options: optionsMap,
    deepPartial(this: JSONDiscriminatedUnion<Discriminator, Options>) {
      const newOptionsMap: OptionsMap<
        Discriminator,
        DiscriminatedOptions<Discriminator>
      > = new Map();

      optionsMap.forEach((option, key) => {
        const partial =
          option.deepPartial() as unknown as JSONDiscriminatedObject<Discriminator>;
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
