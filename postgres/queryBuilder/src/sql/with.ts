import { QueryData } from './types';
import { q } from './common';
import { isRaw, getRaw } from '../common';

export const pushWithSql = (
  sql: string[],
  withData: Exclude<QueryData['with'], undefined>,
) => {
  withData.forEach((withItem) => {
    const [name, options, query] = withItem;
    sql.push(
      `WITH ${options.recursive ? 'RECURSIVE ' : ''}${q(name)}${
        options.columns ? `(${options.columns.map(q).join(', ')})` : ''
      } AS ${
        options.materialized
          ? 'MATERIALIZED '
          : options.notMaterialized
          ? 'NOT MATERIALIZED '
          : ''
      }(${isRaw(query) ? getRaw(query) : query.toSql()})`,
    );
  });
};
