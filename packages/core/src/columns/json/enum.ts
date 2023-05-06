import { constructType, JSONType, toCode } from './typeBase';
import { singleQuoteArray } from '../../utils';

// JSON enum type that consists of strings
export interface JSONEnum<
  U extends string = string,
  T extends [U, ...U[]] = [U],
> extends JSONType<T[number], 'enum'> {
  enum: { [k in T[number]]: k };
  options: T;
}

// convert array to JSON enum type
export const arrayToEnum = <U extends string, T extends [U, ...U[]]>(
  items: T,
) => {
  const obj = {} as { [k in T[number]]: k };
  for (const item of items) {
    obj[item] = item;
  }
  return obj;
};

// JSON enum type constructor
export const enumType = <U extends string, T extends [U, ...U[]]>(
  options: T,
) => {
  return constructType<JSONEnum<U, T>>({
    dataType: 'enum',
    enum: arrayToEnum(options),
    options,
    toCode(this: JSONEnum<U, T>, t: string) {
      return toCode(this, t, `${t}.enum(${singleQuoteArray(this.options)})`);
    },
  });
};
