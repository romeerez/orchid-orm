import { QueryData } from './types';
import { expressionToSql } from './common';

export const pushDistinctSql = (
  sql: string[],
  quotedAs: string,
  distinct: Exclude<QueryData['distinct'], undefined>,
) => {
  sql.push('DISTINCT');

  if (distinct.length) {
    const columns: string[] = [];
    distinct?.forEach((item) => {
      columns.push(expressionToSql(quotedAs, item));
    });
    sql.push(`ON (${columns.join(', ')})`);
  }
};
