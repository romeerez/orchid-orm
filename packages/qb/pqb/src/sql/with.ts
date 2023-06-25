import { q } from './common';
import { makeSql, ToSqlCtx } from './toSql';
import { QueryData } from './data';
import { isExpression } from 'orchid-core';

export const pushWithSql = (
  ctx: ToSqlCtx,
  withData: Exclude<QueryData['with'], undefined>,
) => {
  if (!withData.length) return;

  ctx.sql.push(
    'WITH',
    withData
      .map((withItem) => {
        const [name, options, query] = withItem;

        let inner: string;
        if (isExpression(query)) {
          inner = query.toSQL(ctx.values);
        } else {
          inner = makeSql(query, { values: ctx.values }).text;
        }

        return `${options.recursive ? 'RECURSIVE ' : ''}${q(name)}${
          options.columns ? `(${options.columns.map(q).join(', ')})` : ''
        } AS ${
          options.materialized
            ? 'MATERIALIZED '
            : options.notMaterialized
            ? 'NOT MATERIALIZED '
            : ''
        }(${inner})`;
      })
      .join(', '),
  );
};
