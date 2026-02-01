import { ToSQLQuery } from '../../sql/to-sql';
import { addValue } from '../../../utils';
import { SingleSql } from '../../sql/sql';

import { getQuerySchema } from '../../basic-features/schema/schema';

export const makeColumnInfoSql = (
  query: ToSQLQuery,
  column?: string,
): SingleSql => {
  const values: unknown[] = [];

  const schema = getQuerySchema(query);

  let text = `SELECT * FROM information_schema.columns WHERE table_name = ${addValue(
    values,
    query.table,
  )} AND table_catalog = current_database() AND table_schema = ${
    schema ? addValue(values, schema) : 'current_schema()'
  }`;

  if (column) {
    text += ` AND column_name = ${addValue(
      values,
      query.q.shape[column]?.data.name || column,
    )}`;
  }

  return {
    text,
    values,
  };
};
