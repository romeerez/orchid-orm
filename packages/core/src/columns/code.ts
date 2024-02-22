import { RecordKeyTrue, RecordString, singleQuote } from '../utils';
import { ColumnDataBase } from './columnType';
import {
  arrayMethodNames,
  BaseNumberData,
  StringTypeData,
  DateColumnData,
  dateMethodNames,
  numberMethodNames,
  stringMethodNames,
  ArrayMethodsDataForBaseColumn,
} from './columnDataTypes';
import { isRawSQL } from '../raw';

// Type for composing code pieces for the code generation
export type Code = string | Code[];

/**
 * Push code: this will append a code string to the last code array element when possible.
 * @param code - array of code to push into
 * @param add - code to push
 */
export const addCode = (code: Code[], add: Code) => {
  if (typeof add === 'object') {
    code.push(add);
  } else {
    const last = code.length - 1;
    if (typeof code[last] === 'string') {
      code[last] = code[last] + add;
    } else {
      code.push(add);
    }
  }
};

/**
 * Convert the code item into string.
 *
 * @param code - code item
 * @param tabs - each new line will be prefixed with the tabs. Each element of the code represents a new line
 * @param shift - array elements of the given code will be shifted with this sting
 */
export const codeToString = (
  code: Code,
  tabs: string,
  shift: string,
): string => {
  if (typeof code === 'string') return `${tabs}${code}`;

  const lines: string[] = [];
  for (const item of code) {
    if (typeof item === 'string') {
      lines.push(`${tabs}${item}`);
    } else {
      lines.push(codeToString(item, tabs + shift, shift));
    }
  }

  return lines.length ? lines.join('\n') : '';
};

/**
 * Convert a column default value into code string.
 *
 * @param t - column types variable name
 * @param value - column default
 */
export const columnDefaultArgumentToCode = (
  t: string,
  value: unknown,
): string => {
  if (typeof value === 'object' && value && isRawSQL(value)) {
    return value.toCode(t);
  } else if (typeof value === 'function') {
    return value.toString();
  } else if (typeof value === 'string') {
    return singleQuote(value);
  } else {
    return JSON.stringify(value);
  }
};

/**
 * Build a function that will generate a code for a specific column type.
 *
 * @param methodNames - array of column method names to convert to code
 * @param skip - allows skipping some methods
 * @param aliases - provide aliases for specific methods
 */
export const columnMethodsToCode = <T extends ColumnDataBase>(
  methodNames: (keyof T)[],
  skip?: RecordKeyTrue,
  aliases?: RecordString,
) => {
  return (data: T, skipLocal?: RecordKeyTrue) => {
    return methodNames
      .map((key) =>
        (skipLocal || skip)?.[key as string] ||
        (key === 'min' &&
          (data as { nonEmpty?: boolean }).nonEmpty &&
          (data as { min?: number }).min === 1)
          ? ''
          : columnMethodToCode(data, key, aliases?.[key as string]),
      )
      .join('');
  };
};

/**
 * Converts a single column method into code
 *
 * @param data - column `data` object that has info about applied methods
 * @param key - name of the method
 * @param name - optional alias for this method
 */
const columnMethodToCode = <T extends ColumnDataBase, K extends keyof T>(
  data: T,
  key: K,
  name: string = key as string,
): string => {
  const param = data[key];
  if (param === undefined) return '';

  const error = data.errors?.[key as string];

  let params;
  if (typeof param === 'object' && param && param?.constructor === Object) {
    const props: string[] = [];
    for (const key in param) {
      if (key === 'message') continue;

      const value = (param as T)[key as keyof T];
      if (value !== undefined) {
        props.push(
          `${key}: ${typeof value === 'string' ? singleQuote(value) : value}`,
        );
      }
    }

    if (error) props.push(`message: ${singleQuote(error)}`);

    params = props.length ? `{ ${props.join(', ')} }` : '';
  } else {
    params =
      param === true
        ? ''
        : typeof param === 'string'
        ? singleQuote(param)
        : param instanceof Date
        ? `new Date('${param.toISOString()}')`
        : param;

    if (error) {
      if (param !== true) params += ', ';
      params += singleQuote(error);
    }
  }

  return `.${name}(${params})`;
};

// Function to encode string column methods
export const stringDataToCode =
  columnMethodsToCode<StringTypeData>(stringMethodNames);

// Function to encode numeric column methods.
// `int` method is skipped because it's defined by the column type itself.
// Alias `lte` and `gte` to `max` and `min` for readability.
export const numberDataToCode = columnMethodsToCode<BaseNumberData>(
  numberMethodNames,
  undefined,
  { lte: 'max', gte: 'min' },
);

// Function to encode date column methods
export const dateDataToCode =
  columnMethodsToCode<DateColumnData>(dateMethodNames);

// Function to encode array column methods
export const arrayDataToCode =
  columnMethodsToCode<ArrayMethodsDataForBaseColumn>(arrayMethodNames);

/**
 * Converts column type and JSON type custom errors into code
 *
 * @param errors - custom error messages
 */
export const columnErrorMessagesToCode = (errors: RecordString): Code => {
  const props: Code[] = [];

  if (errors.required) {
    props.push(`required: ${singleQuote(errors.required)},`);
  }

  if (errors.invalidType) {
    props.push(`invalidType: ${singleQuote(errors.invalidType)},`);
  }

  const code: Code[] = [];

  if (!props.length) return code;

  addCode(code, '.error({');
  code.push(props);
  addCode(code, '})');

  return code;
};
