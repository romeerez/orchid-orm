import { pushWhereStatementSql } from '../where/where.sql';
import { makeReturningSql } from './insert.sql';
import { processJoinItem } from '../join/join.sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { Query } from '../../query';
import { isRelationQuery } from '../../relations';
import { OrchidOrmInternalError } from '../../errors';
import { makeSql, quoteTableWithSchema, Sql } from '../../sql/sql';
import {
  handleDeleteSelectRelationsSqlState,
  newMutativeQueriesSelectRelationsSqlState,
} from '../../internal-features/mutative-queries-select-relation/mutative-queries-select-relations.sql';
import { anyShape } from '../../../columns';

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

  const relationSelectState = newMutativeQueriesSelectRelationsSqlState(query);

  let returning = makeReturningSql(
    ctx,
    query,
    q,
    quotedAs,
    relationSelectState,
    'Delete',
    undefined,
    isSubSql,
  );

  const selectRelations = handleDeleteSelectRelationsSqlState(
    ctx,
    query,
    relationSelectState,
    returning,
  );

  let join = q.join;
  if (selectRelations) {
    returning =
      (returning ? returning + ', ' : '') + selectRelations.addReturning;

    join = join ? [...join, selectRelations.join] : [selectRelations.join];

    q = {
      ...q,
      joinedShapes: {
        ...q.joinedShapes,
        [selectRelations.joinedShape]: anyShape,
      },
    };
  }

  let conditions: string | undefined;
  if (join?.length) {
    const targets: string[] = [];
    const ons: string[] = [];

    const joinSet = join.length > 1 ? new Set<string>() : null;

    for (const item of join) {
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

  if (!selectRelations?.movedWhereToCte) {
    pushWhereStatementSql(ctx, query, q, quotedAs);
  }

  if (conditions) {
    if (
      !selectRelations?.movedWhereToCte &&
      (q.and?.length || q.or?.length || q.scopes)
    ) {
      ctx.sql.push('AND', conditions);
    } else {
      ctx.sql.push('WHERE', conditions);
    }
  }

  if (returning) {
    ctx.sql.push('RETURNING', returning);
  }

  return makeSql(ctx, 'delete', isSubSql);
};
