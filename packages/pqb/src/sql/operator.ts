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
    `${prefix}${operator(leftExpression, value[op as keyof typeof value])}`,
  );
};
