import { ColumnTypeBase } from './columns/columnType';

// Object representing SQL query.
// Constructed by `toSql`, passed to adapter.query and adapter.array
export type TemplateLiteralArgs = [
  strings: TemplateStringsArray,
  ...values: unknown[],
];

export type Sql = {
  // SQL string
  text: string;
  // bind values passed along with SQL string
  values: unknown[];
  // additional columns to select for `after` hooks
  hookSelect?: string[];
};

// Object representing raw SQL to pass it to various query methods
export type RawExpression<C extends ColumnTypeBase = ColumnTypeBase> = {
  __raw: string | TemplateLiteralArgs;
  __values?: Record<string, unknown> | false;
  __column: C;
};

/**
 * Construct raw SQL to pass it to various query methods
 * @param sql - SQL string or a template string
 * @param values - bind values for a query
 * @param column - optionally provide a resulting column type
 */
export const raw = <C extends ColumnTypeBase = ColumnTypeBase>(
  sql: string | TemplateLiteralArgs,
  values?: Record<string, unknown> | false,
  column?: C,
): RawExpression<C> => ({
  __raw: sql,
  __values: values,
  __column: column as C,
});

/**
 * Check if the object is a raw SQL
 * @param obj - any object
 */
export const isRaw = (obj: object): obj is RawExpression => '__raw' in obj;

/**
 * Get raw SQL string or a template from raw SQL object
 * @param raw
 */
export const getRawSql = (raw: RawExpression) => {
  return raw.__raw;
};
