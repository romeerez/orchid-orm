import { InsertQueryData } from './types';
import { addValue, q, qc } from './common';
import { getRaw, isRaw } from '../common';
import { pushWhereSql } from './where';
import { Query } from '../query';

export const pushInsertSql = (
  sql: string[],
  values: unknown[],
  model: Pick<Query, 'shape' | 'relations'>,
  query: InsertQueryData,
  quotedAs: string,
) => {
  const { columns, values: insertValues, returning, onConflict } = query;
  const quotedColumns = columns.map(q);

  sql.push(
    `INSERT INTO ${quotedAs}(${quotedColumns.join(', ')}) VALUES ${
      isRaw(insertValues)
        ? getRaw(insertValues, values)
        : insertValues
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

  if (onConflict) {
    sql.push('ON CONFLICT');

    if (onConflict.expr) {
      if (typeof onConflict.expr === 'string') {
        sql.push(`(${q(onConflict.expr)})`);
      } else if (Array.isArray(onConflict.expr)) {
        sql.push(`(${onConflict.expr.map(q).join(', ')})`);
      } else {
        sql.push(getRaw(onConflict.expr, values));
      }
    } else {
      sql.push(`(${quotedColumns.join(', ')})`);
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
  pushReturningSql(sql, quotedAs, returning);
};

export const pushReturningSql = (
  sql: string[],
  quotedAs: string,
  returning?: (string[] | '*')[],
) => {
  const items: string[] = [];
  returning?.forEach((item) => {
    items.push(
      item === '*'
        ? '*'
        : item.map((column) => qc(column, quotedAs)).join(', '),
    );
  });

  if (items?.length) {
    sql.push(`RETURNING ${items.join(', ')}`);
  }
};
