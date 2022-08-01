import {
  constructType,
  DeepPartial,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
} from './typeBase';
import { arrayMethods, ArrayMethods } from '../commonMethods';

export type ArrayCardinality = 'many' | 'atLeastOne';

type arrayOutputType<
  T extends JSONTypeAny,
  Cardinality extends ArrayCardinality = 'many',
> = Cardinality extends 'atLeastOne'
  ? [T['type'], ...T['type'][]]
  : T['type'][];

export interface JSONArray<
  Type extends JSONTypeAny,
  Cardinality extends ArrayCardinality = 'many',
> extends JSONType<arrayOutputType<Type, Cardinality>, 'array'>,
    ArrayMethods {
  data: JSONTypeData & {
    min?: number;
    max?: number;
    length?: number;
  };
  element: Type;
  deepPartial(): JSONArray<DeepPartial<Type>, Cardinality>;
  nonEmpty(
    this: JSONArray<Type>,
  ): JSONArray<Type, 'atLeastOne'> & { data: { min: 1 } };
}

export const array = <Type extends JSONTypeAny>(
  element: Type,
): JSONArray<Type> => {
  return constructType<JSONArray<Type>>({
    dataType: 'array' as const,
    element,
    deepPartial(this: JSONArray<Type>) {
      return {
        ...this,
        element: this.element.deepPartial(),
      };
    },
    nonEmpty(this: JSONArray<Type>) {
      return this.min(1) as unknown as JSONArray<Type, 'atLeastOne'> & {
        data: { min: 1 };
      };
    },
    ...arrayMethods,
  });
};
