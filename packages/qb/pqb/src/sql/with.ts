import { toSQL, ToSQLCtx } from './toSQL';
import { WithOptions } from './types';
import { emptyObject, Expression } from 'orchid-core';
import { getSqlText } from './utils';
import { WithItems } from 'pqb';

export const withToSql = (ctx: ToSQLCtx, items: WithItems) => {
  if (!items.length) return;

  const sqls: string[] = [];

  for (const item of items) {
    if (!item) continue;

    let inner: string;
    if (item.q) {
      inner = getSqlText(toSQL(item.q, ctx));
    } else {
      inner = (item.s as Expression).toSQL(ctx, `"${item.n}"`);
    }

    const o = item.o ?? (emptyObject as WithOptions);
    sqls.push(
      `${o.recursive ? 'RECURSIVE ' : ''}"${item.n}"${
        o.columns ? `(${o.columns.map((x) => `"${x}"`).join(', ')})` : ''
      } AS ${
        o.materialized
          ? 'MATERIALIZED '
          : o.notMaterialized
          ? 'NOT MATERIALIZED '
          : ''
      }(${inner})`,
    );
  }

  if (!sqls.length) return;

  return sqls.join(', ');
};

export const pushWithSql = (ctx: ToSQLCtx, items: WithItems) => {
  const sql = withToSql(ctx, items);
  if (sql) ctx.sql.push('WITH', sql);
};
