import {
  constructType,
  DeepPartial,
  JSONType,
  JSONTypeAny,
  JSONTypeData,
  toCode,
} from './typeBase';
import { arrayMethods, ArrayMethods } from '../commonMethods';
import { toArray } from '../../utils';
import { addCode } from '../code';

export type ArrayCardinality = 'many' | 'atLeastOne';

type ArrayOutputType<
  T extends JSONTypeAny,
  Cardinality extends ArrayCardinality = 'many',
> = Cardinality extends 'atLeastOne'
  ? [T['type'], ...T['type'][]]
  : T['type'][];

export interface JSONArray<
  Type extends JSONTypeAny,
  Cardinality extends ArrayCardinality = 'many',
> extends JSONType<ArrayOutputType<Type, Cardinality>, 'array'>,
    ArrayMethods {
  data: JSONTypeData & {
    min?: number;
    max?: number;
    length?: number;
  };
  element: Type;
  deepPartial<T extends JSONArray<Type>>(
    this: T,
  ): JSONArray<DeepPartial<Type>, Cardinality>;
}

export const array = <Type extends JSONTypeAny>(
  element: Type,
): JSONArray<Type> => {
  return constructType<JSONArray<Type>>({
    dataType: 'array' as const,
    element,
    toCode(this: JSONArray<Type>, t: string) {
      const code = [...toArray(this.element.toCode(t))];
      addCode(code, '.array()');

      const { min, max, length, isNonEmpty } = this.data;

      if (min !== undefined && (!isNonEmpty || (isNonEmpty && min !== 1)))
        addCode(code, `.min(${min})`);

      if (max !== undefined) addCode(code, `.max(${max})`);

      if (length !== undefined) addCode(code, `.length(${length})`);

      return toCode(this, t, code);
    },
    deepPartial<T extends JSONArray<Type>>(this: T) {
      return {
        ...this,
        element: this.element.deepPartial(),
        data: {
          ...this.data,
          isDeepPartial: true,
        },
      } as T;
    },
    ...arrayMethods,
  });
};
