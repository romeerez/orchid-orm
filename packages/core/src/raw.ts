import { ColumnTypeBase } from './columns/columnType';

export type Sql = {
  text: string;
  values: unknown[];
};

export type RawExpression<C extends ColumnTypeBase = ColumnTypeBase> = {
  __raw: string | [TemplateStringsArray, ...unknown[]];
  __values?: Record<string, unknown> | false;
  __column: C;
};

export const raw = (
  sql: string | [TemplateStringsArray, ...unknown[]],
  values?: Record<string, unknown> | false,
): RawExpression =>
  ({
    __raw: sql,
    __values: values,
  } as RawExpression);

export const isRaw = (obj: object): obj is RawExpression => '__raw' in obj;

export const getRawSql = (raw: RawExpression) => {
  return raw.__raw;
};
