import { singleQuote, toArray } from '../utils';
import { ColumnChain, ColumnDataBase } from './columnType';
import { isRaw, RawExpression } from '../raw';
import {
  arrayMethodNames,
  ArrayMethodsData,
  BaseNumberData,
  BaseStringData,
  DateColumnData,
  dateMethodNames,
  methodNamesOfSet,
  MethodsDataOfSet,
  numberMethodNames,
  stringMethodNames,
} from './columnDataTypes';

export type Code = string | Code[];

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

export const columnChainToCode = (
  chain: ColumnChain,
  t: string,
  code: Code,
): Code => {
  const result = toArray(code) as Code[];

  for (const item of chain) {
    if (item[0] === 'transform') {
      addCode(result, `.transform(${item[1].toString()})`);
    } else if (item[0] === 'to') {
      addCode(result, `.to(${item[1].toString()}, `);
      addCode(result, item[2].toCode(t));
      addCode(result, ')');
    } else if (item[0] === 'refine') {
      const message = item[2].data.errors?.refine;
      addCode(
        result,
        `.refine(${item[1].toString()}${
          message ? `, ${singleQuote(message)}` : ''
        })`,
      );
    } else if (item[0] === 'superRefine') {
      addCode(result, `.superRefine(${item[1].toString()})`);
    }
  }

  return result.length === 1 && typeof result[0] === 'string'
    ? result[0]
    : result;
};

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

export const columnDefaultArgumentToCode = (
  t: string,
  value: unknown,
): string => {
  if (typeof value === 'object' && value && isRaw(value)) {
    return rawToCode(t, value);
  } else if (typeof value === 'function') {
    return value.toString();
  } else if (typeof value === 'string') {
    return singleQuote(value);
  } else {
    return JSON.stringify(value);
  }
};

export const rawToCode = (t: string, raw: RawExpression): string => {
  const values = raw.__values;
  return `${t}.raw(${singleQuote(raw.__raw)}${
    values ? `, ${JSON.stringify(values)}` : ''
  })`;
};

export const columnMethodsToCode = <T extends ColumnDataBase>(
  methodNames: (keyof T)[],
  skip?: Record<string, true>,
  aliases?: Record<string, string>,
) => {
  return (data: T, skipLocal?: Record<string, true>) => {
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

const columnMethodToCode = <T extends ColumnDataBase, K extends keyof T>(
  data: T,
  key: K,
  name: string = key as string,
): string => {
  const param = data[key];
  if (param === undefined) return '';

  const error = data.errors?.[key === 'nonEmpty' ? 'min' : (key as string)];

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

export const stringDataToCode =
  columnMethodsToCode<BaseStringData>(stringMethodNames);

export const numberDataToCode = columnMethodsToCode<BaseNumberData>(
  numberMethodNames,
  { int: true },
  { lte: 'max', gte: 'min' },
);

export const dateDataToCode =
  columnMethodsToCode<DateColumnData>(dateMethodNames);

export const arrayDataToCode =
  columnMethodsToCode<ArrayMethodsData>(arrayMethodNames);

export const dataOfSetToCode =
  columnMethodsToCode<MethodsDataOfSet>(methodNamesOfSet);

export const columnErrorMessagesToCode = (
  errors: Record<string, string>,
): Code => {
  const props: Code[] = [];

  if (errors.required) {
    props.push(`required: ${singleQuote(errors.required)},`);
  }

  if (errors.invalidType) {
    props.push(`invalidType: ${singleQuote(errors.invalidType)},`);
  }

  const code: Code[] = [];

  if (!props.length) return code;

  addCode(code, '.errors({');
  code.push(props);
  addCode(code, '})');

  return code;
};
