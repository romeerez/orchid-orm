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
          inner = query.toSQL(ctx, `"${name}"`);
        } else {
          inner = makeSql(query, ctx).text;
        }

        return `${options.recursive ? 'RECURSIVE ' : ''}"${name}"${
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
