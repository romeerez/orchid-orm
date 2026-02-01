import { ToSQLQuery } from '../../sql/to-sql';
import { quoteTableWithSchema, SingleSql } from '../../sql/sql';

export interface TruncateOptions {
  restartIdentity?: boolean;
  cascade?: boolean;
}

export const makeTruncateSql = (
  query: ToSQLQuery,
  options?: TruncateOptions,
): SingleSql => {
  let text = `TRUNCATE ${quoteTableWithSchema(query)}`;

  if (options?.restartIdentity) text += ' RESTART IDENTITY';
  if (options?.cascade) text += ' CASCADE';

  return { text, values: [] };
};
