import { QueryData } from './data';
import { queryTypeWithLimitOne } from '../query';
import { addValue } from '../core';

export function pushLimitSQL(sql: string[], values: unknown[], q: QueryData) {
  if (!q.returnsOne) {
    if (queryTypeWithLimitOne[q.returnType as string] && !q.returning) {
      sql.push(`LIMIT 1`);
    } else if (q.limit) {
      sql.push(`LIMIT ${addValue(values, q.limit)}`);
    }
  }
}
