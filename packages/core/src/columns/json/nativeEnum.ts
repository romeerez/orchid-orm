import { JSONType } from './jsonType';
import { jsonTypeToCode } from './code';
import { Code } from '../code';

// type for native enum argument
export type EnumLike = { [k: string]: string | number; [nu: number]: string };

// Filter native enum values: filter out number values, filter out duplicates
export const getValidEnumValues = (obj: EnumLike) => {
  const values: (number | string)[] = [];
  Object.keys(obj).forEach((k) => {
    if (typeof obj[obj[k]] !== 'number' && !values.includes(obj[k])) {
      values.push(obj[k]);
    }
  });
  return values;
};

// JSON type that accepts a native TS enum
export class JSONNativeEnum<T extends EnumLike> extends JSONType<
  T[keyof T],
  { enum: T; options: (number | string)[] }
> {
  declare kind: 'nativeEnum';

  constructor(type: T) {
    super();
    this.data.enum = type;
    this.data.options = getValidEnumValues(type);
  }

  // It's not possible to generate code with an actual enum name, so this outputs simply "enum".
  // User will have to update it later manually.
  toCode(t: string): Code {
    return jsonTypeToCode(this, t, `${t}.nativeEnum(enum)`);
  }
}
