import { pushWhereStatementSql } from './where';
import { makeReturningSql } from './insert';
import { processJoinItem } from './join';
import { ToSQLCtx, ToSQLQuery } from './to-sql';
import { QueryData } from './data';
import {
  isRelationQuery,
  newDelayedRelationSelect,
  Sql,
  OrchidOrmInternalError,
} from '../core';
import { Query } from '../query/query';

export const pushDeleteSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  const from = `"${table.table || query.from}"`;
  ctx.sql.push(`DELETE FROM ${from}`);

  if (from !== quotedAs) {
    ctx.sql.push(quotedAs);
  }

  let conditions: string | undefined;
  if (query.join?.length) {
    const targets: string[] = [];
    const ons: string[] = [];

    const joinSet = query.join.length > 1 ? new Set<string>() : null;

    for (const item of query.join) {
      const lateral = 'l' in item.args && item.args.l;
      if (lateral) {
        if (isRelationQuery(lateral)) {
          continue;
        }

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

  const delayedRelationSelect = query.selectRelation
    ? newDelayedRelationSelect(table)
    : undefined;

  const returning = makeReturningSql(
    ctx,
    table,
    query,
    quotedAs,
    delayedRelationSelect,
    'Delete',
    undefined,
    isSubSql,
  );
  if (returning) ctx.sql.push('RETURNING', returning);

  if (delayedRelationSelect) {
    ctx.topCtx.delayedRelationSelect = delayedRelationSelect;
  }

  return {
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};
