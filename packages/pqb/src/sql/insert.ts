import { QueryData } from './types';
import { q, qc } from './common';
import { quote } from '../quote';
import { getRaw, isRaw } from '../common';
import { pushWhereSql } from './where';
import { Query } from '../query';

export const pushInsertSql = (
  sql: string[],
  model: Pick<Query, 'shape'>,
  query: QueryData,
  quotedAs: string,
  { data, returning }: Exclude<QueryData['insert'], undefined>,
) => {
  const isMany = Array.isArray(data);
  let columns: string[];
  let values: string;
  if (isMany) {
    const columnsMap: Record<string, true> = {};
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        columnsMap[key] = true;
      });
    });

    const keys = Object.keys(columnsMap);
    columns = keys.map((key) => q(key));
    const arr: string[][] = Array(data.length);
    (data as Record<string, unknown>[]).forEach((item, i) => {
      arr[i] = keys.map((key) => (key in item ? quote(item[key]) : 'DEFAULT'));
    });
    values = `${arr.map((row) => `(${row.join(', ')})`).join(', ')}`;
  } else if (
    'values' in data &&
    typeof data.values === 'object' &&
    data.values &&
    isRaw(data.values)
  ) {
    columns = (data.columns as string[]).map((column) => q(column));
    values = getRaw(data.values);
  } else {
    columns = Object.keys(data).map(q);
    values = `(${Object.values(data).map(quote).join(', ')})`;
  }

  sql.push(`INSERT INTO ${quotedAs}(${columns.join(', ')}) VALUES ${values}`);

  const { onConflict } = query;
  if (onConflict) {
    sql.push('ON CONFLICT');

    if (onConflict.expr) {
      if (typeof onConflict.expr === 'string') {
        sql.push(`(${q(onConflict.expr)})`);
      } else if (Array.isArray(onConflict.expr)) {
        sql.push(`(${onConflict.expr.map(q).join(', ')})`);
      } else {
        sql.push(getRaw(onConflict.expr));
      }
    } else {
      sql.push(`(${columns.join(', ')})`);
    }

    if (onConflict.type === 'ignore') {
      sql.push('DO NOTHING');
    } else if (onConflict.type === 'merge') {
      let set: string;

      const { update } = onConflict;
      if (update) {
        if (typeof update === 'string') {
          set = `${q(update)} = excluded.${q(update)}`;
        } else if (Array.isArray(update)) {
          set = update
            .map((column) => `${q(column)} = excluded.${q(column)}`)
            .join(', ');
        } else if (isRaw(update)) {
          set = getRaw(update);
        } else {
          const arr: string[] = [];
          for (const key in update) {
            arr.push(`${q(key)} = ${quote(update[key])}`);
          }
          set = arr.join(', ');
        }
      } else {
        set = columns
          .map((column) => `${column} = excluded.${column}`)
          .join(', ');
      }

      sql.push('DO UPDATE SET', set);
    }
  }

  pushWhereSql(sql, model, query, quotedAs);
  pushReturningSql(sql, quotedAs, returning);
};

export const pushReturningSql = (
  sql: string[],
  quotedAs: string,
  returning?: string[] | '*',
) => {
  if (returning?.length) {
    sql.push(
      `RETURNING ${
        returning === '*'
          ? '*'
          : returning.map((column) => qc(column, quotedAs)).join(', ')
      }`,
    );
  }
};
