import { QueryData, QueryType } from '../query-data';
import { ToSQLCtx } from './to-sql';
import { addTopCte, addTopCteSql } from 'pqb';

export const getShouldWrapMainQueryInCte = (
  ctx: ToSQLCtx,
  q: QueryData,
  type: QueryType,
  isSubSql?: boolean,
): boolean | undefined => {
  return (
    ((!isSubSql && type && ctx.topCtx.cteHooks) || q.appendQueries) && true
  );
};

export const wrapMainQueryInCte = (
  ctx: ToSQLCtx,
  q: QueryData,
  isSubSql?: boolean,
) => {
  let as: string | undefined;
  if (!isSubSql && !ctx.cteName) {
    as = addTopCteSql(ctx, ctx.wrapAs, ctx.sql.join(' '));
  }

  q.appendQueries?.forEach((query) => addTopCte('after', ctx, query));

  if (!isSubSql && !ctx.cteName) {
    const addNull = ctx.topCtx.cteHooks?.hasSelect;
    ctx.sql = [`SELECT *${addNull ? ', NULL' : ''} FROM ${as}`];
  }
};
