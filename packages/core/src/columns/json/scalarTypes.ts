import { constructType, JSONType, JSONTypeAny, toCode } from './typeBase';
import {
  dateTypeMethods,
  numberTypeMethods,
  stringTypeMethods,
} from '../commonMethods';
import { emptyObject } from '../../utils';
import {
  BaseNumberData,
  BaseStringData,
  DateColumnData,
} from '../columnDataTypes';
import { dateDataToCode, numberDataToCode, stringDataToCode } from '../code';

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
    return toCode(this, t, `${t}.bigint()${numberDataToCode(this.data)}`);
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
    return toCode(
      this,
      t,
      `${t}.number()${numberDataToCode(this.data, emptyObject)}`,
    );
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
    return toCode(this, t, `${t}.date()${dateDataToCode(this.data)}`);
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
    return toCode(this, t, `${t}.string()${stringDataToCode(this.data)}`);
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
