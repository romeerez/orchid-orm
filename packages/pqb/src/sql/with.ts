import { QueryData } from './types';
import { q } from './common';
import { isRaw, getRaw } from '../common';

export const pushWithSql = (
  sql: string[],
  values: unknown[],
  withData: Exclude<QueryData['with'], undefined>,
) => {
  withData.forEach((withItem) => {
    const [name, options, query] = withItem;

    let inner: string;
    if (isRaw(query)) {
      inner = getRaw(query, values);
    } else {
      inner = query.toSql(values).text;
    }

    sql.push(
      `WITH ${options.recursive ? 'RECURSIVE ' : ''}${q(name)}${
        options.columns ? `(${options.columns.map(q).join(', ')})` : ''
      } AS ${
        options.materialized
          ? 'MATERIALIZED '
          : options.notMaterialized
          ? 'NOT MATERIALIZED '
          : ''
      }(${inner})`,
    );
  });
};
