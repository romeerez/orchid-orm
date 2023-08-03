import { addValue } from './common';
import { ToSQLCtx } from './toSQL';
import { ColumnInfoQueryData } from './data';
import { Query } from '../query/query';

export const pushColumnInfoSql = (
  ctx: ToSQLCtx,
  table: Query,
  query: ColumnInfoQueryData,
) => {
  ctx.sql.push(
    `SELECT * FROM information_schema.columns WHERE table_name = ${addValue(
      ctx.values,
      table.table,
    )} AND table_catalog = current_database() AND table_schema = ${
      query.schema || 'current_schema()'
    }`,
  );

  if (query.column) {
    ctx.sql.push(
      `AND column_name = ${addValue(
        ctx.values,
        table.q.shape[query.column]?.data.name || query.column,
      )}`,
    );
  }
};
