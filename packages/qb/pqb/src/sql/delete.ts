import { pushWhereStatementSql } from './where';
import { pushReturningSql } from './insert';
import { processJoinItem } from './join';
import { ToSQLCtx, ToSQLQuery } from './toSQL';
import { DeleteQueryData } from './data';
import { getSqlText } from './utils';

import { HookSelect } from 'orchid-core';

export const pushDeleteSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: DeleteQueryData,
  quotedAs: string,
): HookSelect | undefined => {
  const from = `"${table.table}"`;
  ctx.sql.push(`DELETE FROM ${from}`);

  if (from !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  let conditions: string | undefined;
  if (query.join?.length) {
    const targets: string[] = [];
    const ons: string[] = [];

    const joinSet = query.join.length > 1 ? new Set<string>() : null;

    for (const item of query.join) {
      if (Array.isArray(item)) {
        const q = item[1];
        const { aliasValue } = ctx;
        ctx.aliasValue = true;

        const as = item[2];
        targets.push(
          `LATERAL (${getSqlText(q.toSQL(ctx))}) "${
            query.joinOverrides?.[as] || as
          }"`,
        );

        ctx.aliasValue = aliasValue;
      } else {
        const join = processJoinItem(ctx, table, query, item.args, quotedAs);

        const key = `${join.target}${join.on}`;
        if (joinSet) {
          if (joinSet.has(key)) continue;
          joinSet.add(key);
        }
        targets.push(join.target);
        if (join.on) ons.push(join.on);
      }
    }

    if (targets.length) {
      ctx.sql.push(`USING ${targets.join(', ')}`);
    }

    conditions = ons.join(' AND ');
  }

  pushWhereStatementSql(ctx, table, query, quotedAs);

  if (conditions) {
    if (query.and?.length || query.or?.length || query.scopes) {
      ctx.sql.push('AND', conditions);
    } else {
      ctx.sql.push('WHERE', conditions);
    }
  }

  return pushReturningSql(ctx, table, query, quotedAs, query.afterDeleteSelect);
};
