import { SelectQueryData } from './types';
import { expressionToSql } from './common';

export const pushDistinctSql = (
  sql: string[],
  values: unknown[],
  distinct: Exclude<SelectQueryData['distinct'], undefined>,
  quotedAs?: string,
) => {
  sql.push('DISTINCT');

  if (distinct.length) {
    const columns: string[] = [];
    distinct?.forEach((item) => {
      columns.push(expressionToSql(item, values, quotedAs));
    });
    sql.push(`ON (${columns.join(', ')})`);
  }
};
