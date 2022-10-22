import { InsertQueryData, QueryData } from './types';
import { addValue, q } from './common';
import { getRaw, isRaw } from '../common';
import { pushWhereSql } from './where';
import { Query } from '../query';
import { selectToSql } from './select';

export const pushInsertSql = (
  sql: string[],
  values: unknown[],
  model: Query,
  query: InsertQueryData,
  quotedAs: string,
) => {
  const quotedColumns = query.columns.map(q);

  sql.push(
    `INSERT INTO ${quotedAs}(${quotedColumns.join(', ')}) VALUES ${
      isRaw(query.values)
        ? getRaw(query.values, values)
        : query.values
            .map(
              (row) =>
                `(${row
                  .map((value) =>
                    value === undefined ? 'DEFAULT' : addValue(values, value),
                  )
                  .join(', ')})`,
            )
            .join(', ')
    }`,
  );

  if (query.onConflict) {
    sql.push('ON CONFLICT');

    const { expr, type } = query.onConflict;
    if (expr) {
      if (typeof expr === 'string') {
        sql.push(`(${q(expr)})`);
      } else if (Array.isArray(expr)) {
        sql.push(`(${expr.map(q).join(', ')})`);
      } else {
        sql.push(getRaw(expr, values));
      }
    } else {
      sql.push(`(${quotedColumns.join(', ')})`);
    }

    if (type === 'ignore') {
      sql.push('DO NOTHING');
    } else if (type === 'merge') {
      let set: string;

      const { update } = query.onConflict;
      if (update) {
        if (typeof update === 'string') {
          set = `${q(update)} = excluded.${q(update)}`;
        } else if (Array.isArray(update)) {
          set = update
            .map((column) => `${q(column)} = excluded.${q(column)}`)
            .join(', ');
        } else if (isRaw(update)) {
          set = getRaw(update, values);
        } else {
          const arr: string[] = [];
          for (const key in update) {
            arr.push(`${q(key)} = ${addValue(values, update[key])}`);
          }
          set = arr.join(', ');
        }
      } else {
        set = quotedColumns
          .map((column) => `${column} = excluded.${column}`)
          .join(', ');
      }

      sql.push('DO UPDATE SET', set);
    }
  }

  pushWhereSql(sql, model, query, values, quotedAs);
  pushReturningSql(sql, model, query, values, quotedAs);
};

export const pushReturningSql = (
  sql: string[],
  model: Query,
  query: QueryData,
  values: unknown[],
  quotedAs: string,
) => {
  if (query.select) {
    sql.push(`RETURNING ${selectToSql(model, query, values, quotedAs)}`);
  }
};
