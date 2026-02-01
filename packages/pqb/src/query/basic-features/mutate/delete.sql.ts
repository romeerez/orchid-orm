import { pushWhereStatementSql } from '../where/where.sql';
import { makeReturningSql } from './insert.sql';
import { processJoinItem } from '../join/join.sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { Query } from '../../query';
import { isRelationQuery } from '../../relations';
import { OrchidOrmInternalError } from '../../errors';
import { newDelayedRelationSelect } from '../select/delayed-relational-select';
import { makeSql, quoteTableWithSchema, Sql } from '../../sql/sql';

export const pushDeleteSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  const from = quoteTableWithSchema(query);
  ctx.sql.push(`DELETE FROM ${from}`);

  if (q.as && query.table !== q.as) {
    ctx.sql.push(quotedAs);
  }

  let conditions: string | undefined;
  if (q.join?.length) {
    const targets: string[] = [];
    const ons: string[] = [];

    const joinSet = q.join.length > 1 ? new Set<string>() : null;

    for (const item of q.join) {
      const lateral = 'l' in item.args && item.args.l;
      if (lateral) {
        if (isRelationQuery(lateral)) {
          continue;
        }

        throw new OrchidOrmInternalError(
          query as Query,
          'Join lateral is not supported in delete',
        );
      }

      const join = processJoinItem(ctx, query, q, item.args, quotedAs);

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

  pushWhereStatementSql(ctx, query, q, quotedAs);

  if (conditions) {
    if (q.and?.length || q.or?.length || q.scopes) {
      ctx.sql.push('AND', conditions);
    } else {
      ctx.sql.push('WHERE', conditions);
    }
  }

  const delayedRelationSelect = q.selectRelation
    ? newDelayedRelationSelect(query)
    : undefined;

  const returning = makeReturningSql(
    ctx,
    query,
    q,
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

  return makeSql(ctx, 'delete', isSubSql);
};
