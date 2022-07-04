import { QueryData } from './types';
import { q } from './common';
import { isRaw, getRaw } from '../common';

export const pushWithSql = (
  sql: string[],
  withData: Exclude<QueryData['with'], undefined>,
) => {
  withData.forEach((withItem) => {
    const name = q(withItem[0]);
    const columns = withItem[1];
    const query = withItem[2];
    sql.push(
      `WITH ${columns ? `${name}(${columns.map(q).join(', ')})` : name} (${
        isRaw(query) ? getRaw(query) : query.toSql()
      })`,
    );
  });
};
