import { toArray } from '../utils';
import { ColumnChain } from './columnType';

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
