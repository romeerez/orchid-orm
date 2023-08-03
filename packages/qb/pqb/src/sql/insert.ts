import { addValue, ownColumnToSql } from './common';
import { pushWhereStatementSql } from './where';
import { Query } from '../query/query';
import { selectToSql } from './select';
import { makeSQL, ToSQLCtx } from './toSQL';
import { pushQueryValue } from '../query/queryUtils';
import { InsertQueryData, QueryData, QueryHookSelect } from './data';
import { emptyArray, Expression, isExpression } from 'orchid-core';
import { ColumnData } from '../columns';
import { joinSubQuery, resolveSubQueryCallback } from '../common/utils';
import { Db } from '../query/db';
import { RawSQL } from './rawSql';

// reuse array for the columns list
const quotedColumns: string[] = [];

export const pushInsertSql = (
  ctx: ToSQLCtx,
  q: Query,
  query: InsertQueryData,
  quotedAs: string,
): QueryHookSelect | undefined => {
  const { columns, shape } = query;
  quotedColumns.length = columns.length;
  for (let i = 0, len = columns.length; i < len; i++) {
    quotedColumns[i] = `"${shape[columns[i]]?.data.name || columns[i]}"`;
  }

  let runtimeDefaults: (() => unknown)[] | undefined;
  if (q.internal.runtimeDefaultColumns) {
    runtimeDefaults = [];
    for (const key of q.internal.runtimeDefaultColumns) {
      if (!columns.includes(key)) {
        const column = shape[key];
        quotedColumns.push(`"${column.data.name || key}"`);
        runtimeDefaults.push(column.data.default as () => unknown);
      }
    }
  }

  let values = query.values;
  if (quotedColumns.length === 0) {
    const key = Object.keys(q.shape)[0];
    const column = q.shape[key];
    quotedColumns[0] = `"${column?.data.name || key}"`;

    if (Array.isArray(values) && Array.isArray(values[0])) {
      values = [[undefined]];
    }
  }

  ctx.sql.push(`INSERT INTO ${quotedAs}(${quotedColumns.join(', ')})`);

  const QueryClass = ctx.queryBuilder.constructor as Db;

  if (query.kind === 'object') {
    ctx.sql.push(
      `VALUES ${(values as unknown[][]).reduce(
        (sql, row, i) =>
          sql +
          (i ? ', ' : '') +
          `(${encodeRow(ctx, q, QueryClass, row, runtimeDefaults, quotedAs)})`,
        '',
      )}`,
    );
  } else if (query.kind === 'raw') {
    if (isExpression(values)) {
      let valuesSql = values.toSQL(ctx, quotedAs);

      if (runtimeDefaults) {
        valuesSql += `, ${runtimeDefaults
          .map((fn) => addValue(ctx.values, fn()))
          .join(', ')}`;
      }

      ctx.sql.push(`VALUES (${valuesSql})`);
    } else {
      let sql;

      if (runtimeDefaults) {
        const { values: v } = ctx;
        sql = (values as Expression[])
          .map(
            (raw) =>
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              `(${raw.toSQL(ctx, quotedAs)}, ${runtimeDefaults!
                .map((fn) => addValue(v, fn()))
                .join(', ')})`,
          )
          .join(', ');
      } else {
        sql = (values as Expression[])
          .map((raw) => `(${raw.toSQL(ctx, quotedAs)})`)
          .join(', ');
      }

      ctx.sql.push(`VALUES ${sql}`);
    }
  } else {
    const { from, values: v } = values as { from: Query; values?: unknown[][] };
    const q = from.clone();

    if (v) {
      pushQueryValue(
        q,
        'select',
        new RawSQL(
          encodeRow(ctx, q, QueryClass, v[0], runtimeDefaults, quotedAs),
        ),
      );
    }

    ctx.sql.push(makeSQL(q, { values: ctx.values }).text);
  }

  if (query.onConflict) {
    ctx.sql.push('ON CONFLICT');

    const { expr, type } = query.onConflict;
    if (expr) {
      if (typeof expr === 'string') {
        ctx.sql.push(`("${shape[expr]?.data.name || expr}")`);
      } else if (Array.isArray(expr)) {
        ctx.sql.push(
          `(${expr.reduce(
            (sql, item, i) =>
              sql + (i ? ', ' : '') + `"${shape[item]?.data.name || item}"`,
            '',
          )})`,
        );
      } else {
        ctx.sql.push(expr.toSQL(ctx, quotedAs));
      }
    } else if (type === 'merge') {
      // TODO: optimize, unique columns could be stored in Query.internal
      // consider saving a cache of columns for this case into Query.internal

      const { indexes } = q.internal;

      const quotedUniques = columns.reduce((arr: string[], key, i) => {
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
          const name = shape[update]?.data.name || update;
          set = `"${name}" = excluded."${name}"`;
        } else if (Array.isArray(update)) {
          set = update.reduce((sql, item, i) => {
            const name = shape[item]?.data.name || item;
            return sql + (i ? ', ' : '') + `"${name}" = excluded."${name}"`;
          }, '');
        } else if (isExpression(update)) {
          set = update.toSQL(ctx, quotedAs);
        } else {
          const arr: string[] = [];
          for (const key in update) {
            arr.push(
              `"${shape[key]?.data.name || key}" = ${addValue(
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

  pushWhereStatementSql(ctx, q, query, quotedAs);
  return pushReturningSql(ctx, q, query, quotedAs, query.afterCreateSelect);
};

const encodeRow = (
  ctx: ToSQLCtx,
  q: Query,
  QueryClass: Db,
  row: unknown[],
  runtimeDefaults?: (() => unknown)[],
  quotedAs?: string,
) => {
  const arr = row.map((value) => {
    if (typeof value === 'function') {
      value = resolveSubQueryCallback(q, value as (q: Query) => Query);
    }

    if (value && typeof value === 'object') {
      if (value instanceof Expression) {
        return value.toSQL(ctx, quotedAs);
      } else if (value instanceof QueryClass) {
        return `(${joinSubQuery(q, value as Query).toSQL(ctx).text})`;
      }
    }

    return value === undefined ? 'DEFAULT' : addValue(ctx.values, value);
  });

  if (runtimeDefaults) {
    for (const fn of runtimeDefaults) {
      arr.push(addValue(ctx.values, fn()));
    }
  }

  return arr.join(', ');
};

export const pushReturningSql = (
  ctx: ToSQLCtx,
  q: Query,
  data: QueryData,
  quotedAs: string,
  hookSelect?: QueryHookSelect,
): QueryHookSelect | undefined => {
  const { select } = data;
  if (!hookSelect?.length && !select) return hookSelect;

  let selected: string | undefined;
  let hookFiltered: string[] | undefined;
  if (select) {
    selected = selectToSql(ctx, q, data, quotedAs);
    if (hookSelect) {
      if (select.includes('*')) {
        hookFiltered = emptyArray;
      } else {
        hookFiltered = [];
        for (const column of hookSelect) {
          if (
            !hookFiltered.includes(column) &&
            !select?.includes(column) &&
            !select?.includes(`${quotedAs}.${column}`)
          ) {
            hookFiltered.push(column);
          }
        }
      }
    }
  } else {
    hookFiltered = [];
    for (const column of hookSelect as string[]) {
      if (!hookFiltered.includes(column)) hookFiltered.push(column);
    }
  }

  ctx.sql.push('RETURNING');
  if (hookFiltered?.length) {
    if (selected) ctx.sql.push(`${selected},`);
    ctx.sql.push(
      hookFiltered
        .map((column) => ownColumnToSql(data, column, quotedAs))
        .join(', '),
    );
  } else {
    ctx.sql.push(selected as string);
  }

  return hookFiltered;
};
