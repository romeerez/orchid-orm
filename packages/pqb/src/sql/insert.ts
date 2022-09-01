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
  const { data, returning, onConflict } = query;

  const isMany = Array.isArray(data);
  let columns: string[];
  let insertValues: string;
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
      arr[i] = keys.map((key) =>
        key in item ? addValue(values, item[key]) : 'DEFAULT',
      );
    });
    insertValues = `${arr.map((row) => `(${row.join(', ')})`).join(', ')}`;
  } else if (
    'values' in data &&
    typeof data.values === 'object' &&
    data.values &&
    isRaw(data.values)
  ) {
    columns = (data.columns as string[]).map((column) => q(column));
    insertValues = getRaw(data.values, values);
  } else {
    columns = Object.keys(data).map(q);
    insertValues = `(${Object.values(data)
      .map((value) => addValue(values, value))
      .join(', ')})`;
  }

  sql.push(
    `INSERT INTO ${quotedAs}(${columns.join(', ')}) VALUES ${insertValues}`,
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
          set = getRaw(update, values);
        } else {
          const arr: string[] = [];
          for (const key in update) {
            arr.push(`${q(key)} = ${addValue(values, update[key])}`);
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
