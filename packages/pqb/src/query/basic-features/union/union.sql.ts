import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { Expression, isExpression } from '../../expressions/expression';
import { Query } from '../../query';
import { ToSQLCtx } from '../../sql/to-sql';
import { moveMutativeQueryToCte } from '../cte/cte.sql';

export interface UnionItem {
  a: SubQueryForSql | Expression;
  k: UnionKind;
  // true to not wrap the union member into parens.
  p?: boolean;
}

export interface UnionSet {
  b: Query;
  u: UnionItem[];
}

export type UnionKind =
  | 'UNION'
  | 'UNION ALL'
  | 'INTERSECT'
  | 'INTERSECT ALL'
  | 'EXCEPT'
  | 'EXCEPT ALL';

export interface QueryDataUnion {
  b: SubQueryForSql;
  u: UnionItem[];
  // true to not wrap the first union query into parens.
  p?: boolean;
}

export const pushUnionSql = (
  ctx: ToSQLCtx,
  union: QueryDataUnion,
  quotedAs?: string,
) => {
  const { b } = union;
  const s = moveMutativeQueryToCte(ctx, b);
  ctx.sql.push(union.p ? s : `(${s})`);

  for (const u of union.u) {
    const s = isExpression(u.a)
      ? u.a.toSQL(ctx, quotedAs)
      : moveMutativeQueryToCte(ctx, u.a);
    ctx.sql.push(`${u.k} ${u.p ? s : '(' + s + ')'}`);
  }
};
