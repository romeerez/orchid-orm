import { constructType, JSONType } from './typeBase';

export interface JSONEnum<T extends EnumValues>
  extends JSONType<T[number], 'enum'> {
  enum: { [k in T[number]]: k };
  options: T;
}

type EnumValues = readonly [string, ...string[]];

export const arrayToEnum = <T extends string, U extends readonly [T, ...T[]]>(
  items: U,
) => {
  const obj = {} as { [k in U[number]]: k };
  for (const item of items) {
    obj[item] = item;
  }
  return obj;
};

export const enumType = <T extends readonly [string, ...string[]]>(
  options: T,
) => {
  return constructType<JSONEnum<T>>({
    dataType: 'enum',
    enum: arrayToEnum(options),
    options,
  });
};
