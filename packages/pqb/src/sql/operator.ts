import { quote } from '../quote';
import { Query } from '../query';
import { getRaw, isRaw } from '../common';
import { Operator } from '../operators';

export const pushOperatorSql = (
  ands: string[],
  prefix: string,
  operator: Operator<unknown>,
  leftExpression: string,
  value: object,
  op: string,
) => {
  ands.push(
    `${prefix}${operator(
      leftExpression,
      processOperatorArg(value[op as keyof typeof value] as unknown),
    )}`,
  );
};

const processOperatorArg = (arg: unknown): string => {
  if (arg && typeof arg === 'object') {
    if (Array.isArray(arg)) {
      return `(${arg.map(quote).join(', ')})`;
    }

    if ('toSql' in arg) {
      return `(${(arg as Query).toSql()})`;
    }

    if (isRaw(arg)) {
      return getRaw(arg);
    }
  }

  return quote(arg);
};
