import { addValue, q } from './common';
import { pushWhereStatementSql } from './where';
import { Query } from '../query';
import { selectToSql } from './select';
import { makeSql, ToSqlCtx } from './toSql';
import { pushQueryValue } from '../queryDataUtils';
import { getRaw } from '../raw';
import { InsertQueryData, QueryData } from './data';
import { isRaw, raw, RawExpression } from 'orchid-core';
import { ColumnData } from '../columns';

export const pushInsertSql = (
  ctx: ToSqlCtx,
  table: Query,
  query: InsertQueryData,
  quotedAs: string,
) => {
  const { shape } = table.query;

  const quotedColumns = query.columns.map((key) =>
    q(shape[key]?.data.name || key),
  );

  let runtimeDefaults: (() => unknown)[] | undefined;
  if (table.internal.runtimeDefaultColumns) {
    runtimeDefaults = [];
    for (const key of table.internal.runtimeDefaultColumns) {
      if (!query.columns.includes(key)) {
        const column = shape[key];
        quotedColumns.push(q(column.data.name || key));
        runtimeDefaults.push(column.data.default as () => unknown);
      }
    }
  }

  ctx.sql.push(`INSERT INTO ${quotedAs}(${quotedColumns.join(', ')})`);

  if ('from' in query.values) {
    const { from, values } = query.values;
    const q = from.clone();

    if (values) {
      pushQueryValue(
        q,
        'select',
        raw(encodeRow(ctx, values[0], runtimeDefaults), false),
      );
    }

    ctx.sql.push(makeSql(q, { values: ctx.values }).text);
  } else if (isRaw(query.values)) {
    let valuesSql = getRaw(query.values, ctx.values);

    if (runtimeDefaults) {
      valuesSql += `, ${runtimeDefaults
        .map((fn) => addValue(ctx.values, fn()))
        .join(', ')}`;
    }

    ctx.sql.push(`VALUES (${valuesSql})`);
  } else if (isRaw(query.values[0])) {
    let sql;

    if (runtimeDefaults) {
      const { values } = ctx;
      sql = (query.values as RawExpression[])
        .map(
          (raw) =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            `(${getRaw(raw, values)}, ${runtimeDefaults!
              .map((fn) => addValue(values, fn()))
              .join(', ')})`,
        )
        .join(', ');
    } else {
      const { values } = ctx;
      sql = (query.values as RawExpression[])
        .map((raw) => `(${getRaw(raw, values)})`)
        .join(', ');
    }

    ctx.sql.push(`VALUES ${sql}`);
  } else {
    ctx.sql.push(
      `VALUES ${(query.values as unknown[][])
        .map((row) => `(${encodeRow(ctx, row, runtimeDefaults)})`)
        .join(', ')}`,
    );
  }

  if (query.onConflict) {
    ctx.sql.push('ON CONFLICT');

    const { expr, type } = query.onConflict;
    if (expr) {
      if (typeof expr === 'string') {
        ctx.sql.push(`(${q(shape[expr]?.data.name || expr)})`);
      } else if (Array.isArray(expr)) {
        ctx.sql.push(
          `(${expr
            .map((item) => q(shape[item]?.data.name || item))
            .join(', ')})`,
        );
      } else {
        ctx.sql.push(getRaw(expr, ctx.values));
      }
    } else if (type === 'merge') {
      // TODO: optimize, unique columns could be stored in Query.internal
      // consider saving a cache of columns for this case into Query.internal

      const { indexes } = table.internal;

      const quotedUniques = query.columns.reduce((arr: string[], key, i) => {
        const unique =
          // check column index
          (shape[key]?.data as ColumnData).indexes?.some(
            (index) => index.unique,
          ) ||
          // check table composite indexes
          indexes?.some((index) =>
            index.columns.some(
              (item) => 'column' in item && item.column === key,
            ),
          );

        if (unique) arr.push(quotedColumns[i]);
        return arr;
      }, []);

      ctx.sql.push(`(${quotedUniques.join(', ')})`);
    }

    if (type === 'ignore') {
      ctx.sql.push('DO NOTHING');
    } else if (type === 'merge') {
      let set: string;

      const { update } = query.onConflict;
      if (update) {
        if (typeof update === 'string') {
          const name = q(shape[update]?.data.name || update);
          set = `${name} = excluded.${name}`;
        } else if (Array.isArray(update)) {
          set = update
            .map((item) => {
              const name = q(shape[item]?.data.name || item);
              return `${name} = excluded.${name}`;
            })
            .join(', ');
        } else if (isRaw(update)) {
          set = getRaw(update, ctx.values);
        } else {
          const arr: string[] = [];
          for (const key in update) {
            arr.push(
              `${q(shape[key]?.data.name || key)} = ${addValue(
                ctx.values,
                update[key],
              )}`,
            );
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

const encodeRow = (
  ctx: ToSqlCtx,
  row: unknown[],
  runtimeDefaults?: (() => unknown)[],
) => {
  const arr = row.map((value) =>
    value === undefined ? 'DEFAULT' : addValue(ctx.values, value),
  );

  if (runtimeDefaults) {
    for (const fn of runtimeDefaults) {
      arr.push(addValue(ctx.values, fn()));
    }
  }

  return arr.join(', ');
};

export const pushReturningSql = (
  ctx: ToSqlCtx,
  table: Query,
  query: QueryData,
  quotedAs: string,
) => {
  if (query.select) {
    ctx.sql.push(`RETURNING ${selectToSql(ctx, table, query, quotedAs)}`);
  }
};
