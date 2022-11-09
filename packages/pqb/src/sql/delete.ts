import { QueryBase } from '../query';
import { DeleteQueryData } from './types';
import { pushWhereStatementSql } from './where';
import { pushReturningSql } from './insert';
import { processJoinItem } from './join';
import { ToSqlCtx } from './toSql';
import { q } from './common';

export const pushDeleteSql = (
  ctx: ToSqlCtx,
  model: QueryBase,
  query: DeleteQueryData,
  quotedAs: string,
) => {
  const from = q(model.table as string);
  ctx.sql.push(`DELETE FROM ${from}`);

  if (from !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  let conditions: string | undefined;
  if (query.join?.length) {
    const items = query.join.map((item) =>
      processJoinItem(ctx, model, item.args, quotedAs),
    );

    ctx.sql.push(`USING ${items.map((item) => item.target).join(', ')}`);

    conditions = items
      .map((item) => item.conditions)
      .filter(Boolean)
      .join(' AND ');
  }

  pushWhereStatementSql(ctx, model, query, quotedAs);

  if (conditions?.length) {
    if (query.and?.length || query.or?.length) {
      ctx.sql.push('AND', conditions);
    } else {
      ctx.sql.push('WHERE', conditions);
    }
  }

  pushReturningSql(ctx, model, query, quotedAs);
};
