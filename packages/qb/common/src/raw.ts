import { ColumnTypeBase } from './columns/columnType';
export type RawExpression<C extends ColumnTypeBase = ColumnTypeBase> = {
  __raw: string;
  __values?: Record<string, unknown> | false;
  __column: C;
};

export const raw = (
  sql: string,
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
