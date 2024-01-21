import { pushWhereStatementSql } from './where';
import { pushReturningSql } from './insert';
import { processJoinItem } from './join';
import { ToSQLCtx, ToSQLQuery } from './toSQL';
import { DeleteQueryData, QueryHookSelect } from './data';

export const pushDeleteSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: DeleteQueryData,
  quotedAs: string,
): QueryHookSelect | undefined => {
  const from = `"${table.table}"`;
  ctx.sql.push(`DELETE FROM ${from}`);

  if (from !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  let conditions: string | undefined;
  if (query.join?.length) {
    const items: { target: string; conditions?: string }[] = [];
    for (const item of query.join) {
      // skip join lateral: it's not supported here, and it's not clean if it's supported in DELETE by the db
      if (!Array.isArray(item)) {
        items.push(processJoinItem(ctx, table, query, item, quotedAs));
      }
    }

    if (items.length) {
      ctx.sql.push(`USING ${items.map((item) => item.target).join(', ')}`);

      conditions = items
        .map((item) => item.conditions)
        .filter(Boolean)
        .join(' AND ');
    }
  }

  pushWhereStatementSql(ctx, table, query, quotedAs);

  if (conditions?.length) {
    if (query.and?.length || query.or?.length) {
      ctx.sql.push('AND', conditions);
    } else {
      ctx.sql.push('WHERE', conditions);
    }
  }

  return pushReturningSql(ctx, table, query, quotedAs, query.afterDeleteSelect);
};
