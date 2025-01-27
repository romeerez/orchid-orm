import { pushWhereStatementSql } from './where';
import { makeReturningSql } from './insert';
import { processJoinItem } from './join';
import { ToSQLCtx, ToSQLQuery } from './toSQL';
import { DeleteQueryData } from './data';
import { HookSelect } from 'orchid-core';
import { OrchidOrmInternalError } from '../errors';
import { Query } from '../query/query';

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
        throw new OrchidOrmInternalError(
          table as Query,
          'Join lateral is not supported in delete',
        );
      }

      const join = processJoinItem(ctx, table, query, item.args, quotedAs);

      const key = `${join.target}${join.on}`;
      if (joinSet) {
        if (joinSet.has(key)) continue;
        joinSet.add(key);
      }
      targets.push(join.target);
      if (join.on) ons.push(join.on);
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

  const returning = makeReturningSql(ctx, table, query, quotedAs, 3);
  if (returning.select) ctx.sql.push('RETURNING', returning.select);

  return returning.hookSelect;
};
