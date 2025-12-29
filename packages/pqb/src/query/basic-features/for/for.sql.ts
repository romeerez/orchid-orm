import { isExpression } from '../../expressions/expression';
import { QueryData } from '../../query-data';
import { ToSQLCtx } from '../../sql/to-sql';

export const pushForSql = (
  ctx: ToSQLCtx,
  q: QueryData,
  type: QueryData['type'],
  quotedAs?: string,
) => {
  if (q.for && (type !== 'upsert' || !q.upsertSecond)) {
    ctx.sql.push('FOR', q.for.type);
    const { tableNames } = q.for;
    if (tableNames) {
      ctx.sql.push(
        'OF',
        isExpression(tableNames)
          ? tableNames.toSQL(ctx, quotedAs)
          : tableNames.map((x) => `"${x}"`).join(', '),
      );
    }
    if (q.for.mode) ctx.sql.push(q.for.mode);
  }
};
