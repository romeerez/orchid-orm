import { QueryData } from './types';
import { q } from './common';
import { isRaw, getRaw } from '../common';
import { Query } from '../query';

export const pushWithSql = (
  model: Query,
  sql: string[],
  withData: Exclude<QueryData['with'], undefined>,
) => {
  withData.forEach((withItem) => {
    const name = q(withItem[0]);
    const columns = withItem[1];
    const query = withItem[2];
    sql.push(
      `WITH ${columns ? `${name}(${columns.map(q).join(', ')})` : name} (${
        isRaw(query)
          ? getRaw(query)
          : typeof query === 'function'
          ? query(model.queryBuilder).toSql()
          : query.toSql()
      })`,
    );
  });
};
