import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';
import { BaseNumberData } from '../number';
import { BaseStringData } from '../string';
import {
  dateTypeMethods,
  numberTypeMethods,
  stringTypeMethods,
} from '../commonMethods';
import { DateColumnData } from '../dateTime';
import { singleQuote } from '../../utils';

export type JSONAny = JSONTypeAny & {
  dataType: 'any';
};
const any = () => {
  return constructType<JSONAny>({
    dataType: 'any',
    toCode(this: JSONAny, t: string) {
      return toCode(this, t, `${t}.any()`);
    },
  });
};

export type JSONBigInt = JSONType<bigint, 'bigint'> & {
  data: BaseNumberData;
} & typeof bigIntMethods;
const bigIntMethods = {
  dataType: 'bigint' as const,
  ...numberTypeMethods,
  toCode(this: JSONTypeAny, t: string) {
    return toCode(this, t, `${t}.bigint()`);
  },
};
const bigint = () => {
  return constructType<JSONBigInt>(bigIntMethods);
};

export type JSONBoolean = JSONType<boolean, 'boolean'>;
const boolean = () => {
  return constructType<JSONBoolean>({
    dataType: 'boolean',
    toCode(this: JSONBoolean, t: string) {
      return toCode(this, t, `${t}.boolean()`);
    },
  });
};

export type JSONNaN = JSONType<number, 'nan'>;
const nan = () => {
  return constructType<JSONNaN>({
    dataType: 'nan',
    toCode(this: JSONNaN, t: string) {
      return toCode(this, t, `${t}.nan()`);
    },
  });
};

export type JSONNever = JSONType<unknown, 'never'>;
const never = () => {
  return constructType<JSONNever>({
    dataType: 'never',
    toCode(this: JSONNever, t: string) {
      return toCode(this, t, `${t}.never()`);
    },
  });
};

export type JSONNull = JSONType<null, 'null'>;
const nullType = () => {
  return constructType<JSONNull>({
    dataType: 'null',
    toCode(this: JSONNull, t: string) {
      return toCode(this, t, `${t}.null()`);
    },
  });
};

export type JSONNumber = JSONType<number, 'number'> & {
  data: BaseNumberData;
} & typeof numberMethods;
const numberMethods = {
  ...numberTypeMethods,
  dataType: 'number' as const,
  toCode(
    this: JSONType<number, 'number'> & {
      data: BaseNumberData;
    },
    t: string,
  ) {
    let code = `${t}.number()`;

    if (this.data.gte !== undefined) code += `.min(${this.data.gte})`;
    if (this.data.gt !== undefined) code += `.gt(${this.data.gt})`;
    if (this.data.lte !== undefined) code += `.max(${this.data.lte})`;
    if (this.data.lt !== undefined) code += `.lt(${this.data.lt})`;
    if (this.data.multipleOf !== undefined)
      code += `.step(${this.data.multipleOf})`;
    if (this.data.int) code += `.int()`;

    return toCode(this, t, code);
  },
};
const number = () => {
  return constructType<JSONNumber>(numberMethods);
};

export type JSONDate = JSONType<Date, 'date'> & {
  data: DateColumnData;
} & typeof dateTypeMethods;
const dateMethods = {
  ...dateTypeMethods,
  dataType: 'date' as const,
  toCode(
    this: JSONType<Date, 'date'> & {
      data: DateColumnData;
    },
    t: string,
  ) {
    let code = `${t}.date()`;

    if (this.data.min)
      code += `.min(new Date('${this.data.min.toISOString()}'))`;
    if (this.data.max)
      code += `.max(new Date('${this.data.max.toISOString()}'))`;

    return toCode(this, t, code);
  },
};
const date = () => {
  return constructType<JSONDate>(dateMethods);
};

export type JSONString = JSONType<string, 'string'> & {
  data: BaseStringData;
} & typeof stringMethods;
const stringMethods = {
  ...stringTypeMethods(),
  dataType: 'string' as const,
  toCode(
    this: JSONType<string, 'string'> & {
      data: BaseStringData;
    },
    t: string,
  ) {
    let code = `${t}.string()`;

    const { min, isNonEmpty } = this.data;

    if (min !== undefined && (!isNonEmpty || (isNonEmpty && min !== 1)))
      code += `.min(${min})`;

    if (this.data.max !== undefined) code += `.max(${this.data.max})`;
    if (this.data.length !== undefined) code += `.length(${this.data.length})`;
    if (this.data.email !== undefined) code += `.email()`;
    if (this.data.url !== undefined) code += `.url()`;
    if (this.data.uuid !== undefined) code += `.uuid()`;
    if (this.data.cuid !== undefined) code += `.cuid()`;
    if (this.data.regex) code += `.regex(${this.data.regex.toString()})`;
    if (this.data.startsWith !== undefined)
      code += `.startsWith(${singleQuote(this.data.startsWith)})`;
    if (this.data.endsWith !== undefined)
      code += `.endsWith(${singleQuote(this.data.endsWith)})`;
    if (this.data.cuid !== undefined) code += `.trim()`;

    return toCode(this, t, code);
  },
};
const string = () => {
  return constructType<JSONString>(stringMethods);
};

export type JSONUndefined = JSONType<undefined, 'undefined'>;
const undefinedType = () => {
  return constructType<JSONUndefined>({
    dataType: 'undefined',
    toCode(this: JSONUndefined, t: string) {
      return toCode(this, t, `${t}.undefined()`);
    },
  });
};

export type JSONUnknown = JSONType<unknown, 'unknown'>;
const unknown = () => {
  return constructType<JSONUnknown>({
    dataType: 'unknown',
    toCode(this: JSONUnknown, t: string) {
      return toCode(this, t, `${t}.unknown()`);
    },
  });
};

export type JSONVoid = JSONType<void, 'void'>;
const voidType = () => {
  return constructType<JSONVoid>({
    dataType: 'void',
    toCode(this: JSONVoid, t: string) {
      return toCode(this, t, `${t}.void()`);
    },
  });
};

export const scalarTypes = {
  any,
  bigint,
  boolean,
  date,
  nan,
  never,
  null: nullType,
  number,
  string,
  undefined: undefinedType,
  unknown,
  void: voidType,
};
