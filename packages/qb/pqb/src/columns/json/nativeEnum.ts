import { constructType, JSONType, toCode } from './typeBase';

export interface JSONNativeEnum<T extends EnumLike>
  extends JSONType<T[keyof T], 'nativeEnum'> {
  dataType: 'nativeEnum';
  enum: T;
  options: (number | string)[];
}

export type EnumLike = { [k: string]: string | number; [nu: number]: string };

export const getValidEnumValues = (obj: EnumLike) => {
  const values: (number | string)[] = [];
  Object.keys(obj).forEach((k) => {
    if (typeof obj[obj[k]] !== 'number' && !values.includes(obj[k])) {
      values.push(obj[k]);
    }
  });
  return values;
};

export const nativeEnum = <T extends EnumLike>(givenEnum: T) => {
  const options = getValidEnumValues(givenEnum);

  return constructType<JSONNativeEnum<T>>({
    dataType: 'nativeEnum',
    enum: givenEnum,
    options,
    toCode(this: JSONNativeEnum<T>, t: string) {
      return toCode(this, t, `${t}.nativeEnum(enum)`);
    },
  });
};
