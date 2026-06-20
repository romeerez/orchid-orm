import { quoteTableWithSchema, SingleSql } from '../../sql/sql';
import { ToSQLQuery } from '../../sql/to-sql';
import { type RefreshMaterializedViewOptions } from './materialized-view.query';

export const makeRefreshMaterializedViewSql = (
  query: ToSQLQuery,
  options?: RefreshMaterializedViewOptions,
): SingleSql => {
  if (options?.concurrently && options.withData === false) {
    throw new Error(
      'Cannot refresh a materialized view concurrently with WITH NO DATA',
    );
  }

  const sql = ['REFRESH MATERIALIZED VIEW'];

  if (options?.concurrently) sql.push('CONCURRENTLY');

  sql.push(quoteTableWithSchema(query));

  if (options?.withData === true) {
    sql.push('WITH DATA');
  } else if (options?.withData === false) {
    sql.push('WITH NO DATA');
  }

  return {
    text: sql.join(' '),
    values: [],
  };
};
