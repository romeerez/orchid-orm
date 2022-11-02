import { QueryData } from './types';
import { q } from './common';
import { isRaw, getRaw } from '../common';
import { ToSqlCtx } from './toSql';

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
        if (isRaw(query)) {
          inner = getRaw(query, ctx.values);
        } else {
          inner = query.toSql({ values: ctx.values }).text;
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
