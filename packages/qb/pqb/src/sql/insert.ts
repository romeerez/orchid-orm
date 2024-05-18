import { ownColumnToSql } from './common';
import { pushWhereStatementSql } from './where';
import { Query } from '../query/query';
import { selectToSql } from './select';
import { makeSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import { pushQueryValue } from '../query/queryUtils';
import { InsertQueryData, QueryData, QueryHookSelect } from './data';
import {
  addValue,
  ColumnTypeBase,
  emptyArray,
  Expression,
  isExpression,
  toArray,
} from 'orchid-core';
import { joinSubQuery, resolveSubQueryCallback } from '../common/utils';
import { Db } from '../query/db';
import { RawSQL } from './rawSql';

// reuse array for the columns list
const quotedColumns: string[] = [];

export const pushInsertSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
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
        runtimeDefaults.push(column.data.runtimeDefault as () => unknown);
      }
    }
  }

  let values = query.values;
  if (quotedColumns.length === 0) {
    const key = Object.keys(q.shape)[0];
    const column = q.shape[key] as ColumnTypeBase;
    quotedColumns[0] = `"${column?.data.name || key}"`;

    // for `create({})` case: `{}` is transformed into `[[]]`,
    // we replace it with `[[undefined]]`, and it generates SQL `VALUES (DEFAULT)`
    if (Array.isArray(values) && Array.isArray(values[0])) {
      values = [[undefined]];
    }
  }

  ctx.sql.push(`INSERT INTO ${quotedAs}(${quotedColumns.join(', ')})`);

  const QueryClass = ctx.queryBuilder.constructor as unknown as Db;

  if (query.kind === 'object') {
    let sql = '';
    for (let i = 0; i < (values as unknown[][]).length; i++) {
      if (i) sql += ', ';
      sql += `(${encodeRow(
        ctx,
        q,
        QueryClass,
        (values as unknown[][])[i],
        runtimeDefaults,
        quotedAs,
      )})`;
    }

    ctx.sql.push(`VALUES ${sql}`);
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

    const { target } = query.onConflict;
    if (target) {
      if (typeof target === 'string') {
        ctx.sql.push(`("${shape[target]?.data.name || target}")`);
      } else if (Array.isArray(target)) {
        ctx.sql.push(
          `(${target.reduce(
            (sql, item, i) =>
              sql + (i ? ', ' : '') + `"${shape[item]?.data.name || item}"`,
            '',
          )})`,
        );
      } else if ('toSQL' in target) {
        ctx.sql.push(target.toSQL(ctx, quotedAs));
      } else {
        ctx.sql.push(`ON CONSTRAINT "${target.constraint}"`);
      }
    }

    // merge: undefined should also be handled by this `if`
    if ('merge' in query.onConflict) {
      let sql: string;

      const { merge } = query.onConflict;
      if (merge) {
        if (typeof merge === 'string') {
          const name = shape[merge]?.data.name || merge;
          sql = `"${name}" = excluded."${name}"`;
        } else if ('except' in merge) {
          const notExcluded: string[] = [];
          const except = toArray(merge.except);
          for (let i = 0; i < columns.length; i++) {
            if (!except.includes(columns[i])) {
              notExcluded.push(quotedColumns[i]);
            }
          }
          sql = mergeColumnsSql(notExcluded);
        } else {
          sql = merge.reduce((sql, item, i) => {
            const name = shape[item]?.data.name || item;
            return sql + (i ? ', ' : '') + `"${name}" = excluded."${name}"`;
          }, '');
        }
      } else {
        sql = mergeColumnsSql(quotedColumns);
      }

      ctx.sql.push('DO UPDATE SET', sql);
    } else if (query.onConflict.set) {
      let sql: string;

      const { set } = query.onConflict;
      if (isExpression(set)) {
        sql = set.toSQL(ctx, quotedAs);
      } else {
        const arr: string[] = [];
        for (const key in set) {
          arr.push(
            `"${shape[key]?.data.name || key}" = ${addValue(
              ctx.values,
              set[key],
            )}`,
          );
        }
        sql = arr.join(', ');
      }

      ctx.sql.push('DO UPDATE SET', sql);
    } else {
      ctx.sql.push('DO NOTHING');
    }
  }

  pushWhereStatementSql(ctx, q, query, quotedAs);
  return pushReturningSql(ctx, q, query, quotedAs, query.afterCreateSelect);
};

const mergeColumnsSql = (quotedColumns: string[]): string => {
  return quotedColumns
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
};

const encodeRow = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  QueryClass: Db,
  row: unknown[],
  runtimeDefaults?: (() => unknown)[],
  quotedAs?: string,
) => {
  const arr = row.map((value) => {
    if (typeof value === 'function') {
      value = resolveSubQueryCallback(
        q,
        value as (q: ToSQLQuery) => ToSQLQuery,
      );
    }

    if (value && typeof value === 'object') {
      if (value instanceof Expression) {
        return value.toSQL(ctx, quotedAs);
      } else if (value instanceof (QueryClass as never)) {
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
  q: ToSQLQuery,
  data: QueryData,
  quotedAs: string,
  hookSelect?: QueryHookSelect,
  keyword = 'RETURNING', // noop update can use this function for `SELECT` list
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

  ctx.sql.push(keyword);
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
