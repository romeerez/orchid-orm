import { QueryData } from './types';
import { q, qc } from './common';
import { quote } from '../quote';

export const pushInsertSql = (
  sql: string[],
  quotedAs: string,
  { data, returning }: Exclude<QueryData['insert'], undefined>,
) => {
  const isMany = Array.isArray(data);
  let columns: string[];
  let values: string[][];
  if (isMany) {
    const columnsMap: Record<string, true> = {};
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        columnsMap[key] = true;
      });
    });

    const keys = Object.keys(columnsMap);
    columns = keys.map((key) => q(key));
    values = Array(data.length);
    (data as Record<string, unknown>[]).forEach((item, i) => {
      values[i] = keys.map((key) =>
        key in item ? quote(item[key]) : 'DEFAULT',
      );
    });
  } else {
    columns = Object.keys(data).map(q);
    values = [Object.values(data).map(quote)];
  }

  sql.push(`INSERT INTO ${quotedAs}(${columns.join(', ')}) VALUES`);

  sql.push(`${values.map((row) => `(${row.join(', ')})`).join(', ')}`);

  if (returning?.length) {
    sql.push(
      `RETURNING ${returning.map((column) => qc(column, quotedAs)).join(', ')}`,
    );
  }
};
