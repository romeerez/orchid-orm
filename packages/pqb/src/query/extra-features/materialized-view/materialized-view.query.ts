import { Query } from '../../query';
import { ToSQLQuery } from '../../sql/to-sql';
import { type AsyncTransactionState } from '../../basic-features/transaction/transaction';
import { makeRefreshMaterializedViewSql } from './materialized-view.sql';

export interface RefreshMaterializedViewOptions {
  /**
   * Refresh the materialized view without blocking concurrent selects.
   */
  concurrently?: boolean;
  /**
   * Use `WITH DATA` or `WITH NO DATA` for the refreshed materialized view.
   */
  withData?: boolean;
}

/**
 * Refresh a materialized view.
 */
export const refreshMaterializedView = async <
  T extends Query.MaterializedQuery,
>(
  query: T,
  options?: RefreshMaterializedViewOptions,
): Promise<void> => {
  const sql = makeRefreshMaterializedViewSql(
    query as unknown as ToSQLQuery,
    options,
  );
  const state = query.internal.asyncStorage.getStore() as
    | AsyncTransactionState
    | undefined;
  const adapter = state?.transactionAdapter || query.q.adapter;

  await adapter.query(sql.text, sql.values);
};
