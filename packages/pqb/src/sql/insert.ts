import { QueryData } from './types';
import { q, qc } from './common';
import { quote } from '../quote';
import { getRaw } from '../common';
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

  const { onConflict } = query;
  if (onConflict) {
    sql.push('ON CONFLICT');

    if (onConflict.expr) {
      if (typeof onConflict.expr === 'string') {
        sql.push(`(${q(onConflict.expr)})`);
      } else if (Array.isArray(onConflict.expr)) {
        sql.push(`(${onConflict.expr.map(q).join(', ')})`);
      } else {
        sql.push(`(${getRaw(onConflict.expr)})`);
      }
    } else {
      sql.push(`(${columns.join(', ')})`);
    }

    if (onConflict.type === 'ignore') {
      sql.push('DO NOTHING');
    } else if (onConflict.type === 'merge') {
      let set: string[];

      const { update } = onConflict;
      if (update) {
        if (typeof update === 'string') {
          set = [`${q(update)} = excluded.${q(update)}`];
        } else if (Array.isArray(update)) {
          set = update.map((column) => `${q(column)} = excluded.${q(column)}`);
        } else {
          set = [];
          for (const key in update) {
            set.push(`${q(key)} = ${quote(update[key])}`);
          }
        }
      } else {
        set = columns.map((column) => `${column} = excluded.${column}`);
      }

      sql.push('DO UPDATE SET', set.join(', '));
    }
  }

  pushWhereSql(sql, model, query, quotedAs);

  if (returning?.length) {
    sql.push(
      `RETURNING ${returning.map((column) => qc(column, quotedAs)).join(', ')}`,
    );
  }
};
