import { constructType, JSONType, toCode } from './typeBase';
import { singleQuoteArray } from '../../utils';

export interface JSONEnum<
  U extends string = string,
  T extends [U, ...U[]] = [U],
> extends JSONType<T[number], 'enum'> {
  enum: { [k in T[number]]: k };
  options: T;
}

export const arrayToEnum = <U extends string, T extends [U, ...U[]]>(
  items: T,
) => {
  const obj = {} as { [k in T[number]]: k };
  for (const item of items) {
    obj[item] = item;
  }
  return obj;
};

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
