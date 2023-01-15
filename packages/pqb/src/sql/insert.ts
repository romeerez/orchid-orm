import { addValue, q } from './common';
import { pushWhereStatementSql } from './where';
import { QueryBase } from '../query';
import { selectToSql } from './select';
import { makeSql, ToSqlCtx } from './toSql';
import { pushQueryValue } from '../queryDataUtils';
import { getRaw, isRaw, raw } from '../common';
import { InsertQueryData, QueryData } from './data';

export const pushInsertSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: InsertQueryData,
  quotedAs: string,
) => {
  const quotedColumns = query.columns.map(q);

  ctx.sql.push(`INSERT INTO ${quotedAs}(${quotedColumns.join(', ')})`);

  if (query.fromQuery) {
    const q = query.fromQuery.clone();

    pushQueryValue(
      q,
      'select',
      isRaw(query.values)
        ? query.values
        : raw(encodeRow(ctx, query.values[0]), false),
    );

    ctx.sql.push(makeSql(q, { values: ctx.values }).text);
  } else {
    ctx.sql.push(
      `VALUES ${
        isRaw(query.values)
          ? getRaw(query.values, ctx.values)
          : query.values.map((row) => `(${encodeRow(ctx, row)})`).join(', ')
      }`,
    );
  }

  if (query.onConflict) {
    ctx.sql.push('ON CONFLICT');

    const { expr, type } = query.onConflict;
    if (expr) {
      if (typeof expr === 'string') {
        ctx.sql.push(`(${q(expr)})`);
      } else if (Array.isArray(expr)) {
        ctx.sql.push(`(${expr.map(q).join(', ')})`);
      } else {
        ctx.sql.push(getRaw(expr, ctx.values));
      }
    } else {
      ctx.sql.push(`(${quotedColumns.join(', ')})`);
    }

    if (type === 'ignore') {
      ctx.sql.push('DO NOTHING');
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
          set = getRaw(update, ctx.values);
        } else {
          const arr: string[] = [];
          for (const key in update) {
            arr.push(`${q(key)} = ${addValue(ctx.values, update[key])}`);
          }
          set = arr.join(', ');
        }
      } else {
        set = quotedColumns
          .map((column) => `${column} = excluded.${column}`)
          .join(', ');
      }

      ctx.sql.push('DO UPDATE SET', set);
    }
  }

  pushWhereStatementSql(ctx, table, query, quotedAs);
  pushReturningSql(ctx, table, query, quotedAs);
};

const encodeRow = (ctx: ToSqlCtx, row: unknown[]) => {
  return row
    .map((value) =>
      value === undefined ? 'DEFAULT' : addValue(ctx.values, value),
    )
    .join(', ');
};

export const pushReturningSql = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: QueryData,
  quotedAs: string,
) => {
  if (query.select) {
    ctx.sql.push(`RETURNING ${selectToSql(ctx, table, query, quotedAs)}`);
  }
};
