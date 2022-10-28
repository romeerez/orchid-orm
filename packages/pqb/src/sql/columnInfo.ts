import { ColumnInfoQueryData } from './types';
import { addValue } from './common';
import { ToSqlCtx } from './toSql';

export const pushColumnInfoSql = (
  ctx: ToSqlCtx,
  table: string,
  query: ColumnInfoQueryData,
) => {
  ctx.sql.push(
    `SELECT * FROM information_schema.columns WHERE table_name = ${addValue(
      ctx.values,
      table,
    )} AND table_catalog = current_database() AND table_schema = ${
      query.schema || 'current_schema()'
    }`,
  );

  if (query.column) {
    ctx.sql.push(`AND column_name = ${addValue(ctx.values, query.column)}`);
  }
};
