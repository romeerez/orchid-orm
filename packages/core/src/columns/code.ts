import { singleQuote, toArray } from '../utils';
import { ColumnChain } from './columnType';
import { isRaw, RawExpression } from '../raw';

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
      addCode(result, `.refine(${item[1].toString()})`);
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
