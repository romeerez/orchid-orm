import { pushWhereStatementSql } from './where';
import { Query } from '../query/query';
import { selectToSql } from './select';
import { makeSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import { pushQueryValue } from '../query/queryUtils';
import { InsertQueryData, QueryData } from './data';
import {
  addValue,
  ColumnTypeBase,
  Expression,
  HookSelect,
  isExpression,
  MaybeArray,
  pushOrNewArray,
  SingleSqlItem,
  Sql,
} from 'orchid-core';
import { joinSubQuery } from '../common/utils';
import { Db } from '../query/db';
import { RawSQL } from './rawSql';
import { OnConflictTarget } from './types';
import { getSqlText } from './utils';
import { MAX_BINDING_PARAMS } from './constants';

// reuse array for the columns list
const quotedColumns: string[] = [];

export const makeInsertSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  query: InsertQueryData,
  quotedAs: string,
): Sql => {
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

  ctx.sql.push(
    `INSERT INTO ${quotedAs}(${quotedColumns.join(', ')})`,
    null as never,
  );

  const QueryClass = ctx.queryBuilder.constructor as unknown as Db;

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
          sql = `DO UPDATE SET "${name}" = excluded."${name}"`;
        } else if ('except' in merge) {
          sql = mergeColumnsSql(columns, quotedColumns, target, merge.except);
        } else {
          sql = `DO UPDATE SET ${merge.reduce((sql, item, i) => {
            const name = shape[item]?.data.name || item;
            return sql + (i ? ', ' : '') + `"${name}" = excluded."${name}"`;
          }, '')}`;
        }
      } else {
        sql = mergeColumnsSql(columns, quotedColumns, target);
      }

      ctx.sql.push(sql);
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

  const hookSelect = pushReturningSql(
    ctx,
    q,
    query,
    quotedAs,
    query.afterCreateSelect,
  );

  if (query.kind === 'object') {
    const valuesSql: string[] = [];
    let ctxValues = ctx.values;
    const restValuesLen = ctxValues.length;
    let currentValuesLen = restValuesLen;
    let batch: SingleSqlItem[] | undefined;

    for (let i = 0; i < (values as unknown[][]).length; i++) {
      const encodedRow = `(${encodeRow(
        ctx,
        ctxValues,
        q,
        QueryClass,
        (values as unknown[][])[i],
        runtimeDefaults,
        quotedAs,
      )})`;

      if (ctxValues.length > MAX_BINDING_PARAMS) {
        if (ctxValues.length - currentValuesLen > MAX_BINDING_PARAMS) {
          throw new Error(
            `Too many parameters for a single insert row, max is ${MAX_BINDING_PARAMS}`,
          );
        }

        // save current batch
        ctx.sql[1] = `VALUES ${valuesSql.join(',')}`;
        ctxValues.length = currentValuesLen;
        batch = pushOrNewArray(batch, {
          text: ctx.sql.join(' '),
          values: ctxValues,
        });

        // reset sql and values for the next batch, repeat the last cycle
        ctxValues = ctx.values = [];
        valuesSql.length = 0;
        i--;
      } else {
        currentValuesLen = ctxValues.length;
        valuesSql.push(encodedRow);
      }
    }

    if (batch) {
      ctx.sql[1] = `VALUES ${valuesSql.join(',')}`;
      batch.push({
        text: ctx.sql.join(' '),
        values: ctxValues,
      });

      return {
        hookSelect,
        batch,
      };
    } else {
      ctx.sql[1] = `VALUES ${valuesSql.join(', ')}`;
    }
  } else if (query.kind === 'raw') {
    if (isExpression(values)) {
      let valuesSql = values.toSQL(ctx, quotedAs);

      if (runtimeDefaults) {
        valuesSql += `, ${runtimeDefaults
          .map((fn) => addValue(ctx.values, fn()))
          .join(', ')}`;
      }

      ctx.sql[1] = `VALUES (${valuesSql})`;
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

      ctx.sql[1] = `VALUES ${sql}`;
    }
  } else {
    const { from, values: v } = values as { from: Query; values?: unknown[][] };
    const q = from.clone();

    if (v) {
      pushQueryValue(
        q,
        'select',
        new RawSQL(
          encodeRow(
            ctx,
            ctx.values,
            q,
            QueryClass,
            v[0],
            runtimeDefaults,
            quotedAs,
          ),
        ),
      );
    }

    ctx.sql[1] = getSqlText(makeSQL(q, { values: ctx.values }));
  }

  return {
    hookSelect,
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};

const mergeColumnsSql = (
  columns: string[],
  quotedColumns: string[],
  target: OnConflictTarget | undefined,
  except?: MaybeArray<string>,
): string => {
  const notExcluded: string[] = [];

  const exclude =
    typeof target === 'string'
      ? [target]
      : Array.isArray(target)
      ? [...target]
      : [];

  if (except) {
    if (typeof except === 'string') {
      exclude.push(except);
    } else {
      exclude.push(...except);
    }
  }

  for (let i = 0; i < columns.length; i++) {
    if (!exclude.includes(columns[i])) {
      notExcluded.push(quotedColumns[i]);
    }
  }

  return notExcluded.length
    ? `DO UPDATE SET ${notExcluded
        .map((column) => `${column} = excluded.${column}`)
        .join(', ')}`
    : 'DO NOTHING';
};

const encodeRow = (
  ctx: ToSQLCtx,
  values: unknown[],
  q: ToSQLQuery,
  QueryClass: Db,
  row: unknown[],
  runtimeDefaults?: (() => unknown)[],
  quotedAs?: string,
) => {
  const arr = row.map((value) => {
    if (value && typeof value === 'object') {
      if (value instanceof Expression) {
        return value.toSQL(ctx, quotedAs);
      } else if (value instanceof (QueryClass as never)) {
        return `(${getSqlText(joinSubQuery(q, value as Query).toSQL(ctx))})`;
      }
    }

    return value === undefined ? 'DEFAULT' : addValue(values, value);
  });

  if (runtimeDefaults) {
    for (const fn of runtimeDefaults) {
      arr.push(addValue(values, fn()));
    }
  }

  return arr.join(', ');
};

export const pushReturningSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  data: QueryData,
  quotedAs: string,
  hookSelect?: Set<string>,
  keyword = 'RETURNING', // noop update can use this function for `SELECT` list
): HookSelect | undefined => {
  const { select } = data;
  if (!hookSelect?.size && !select) return hookSelect && new Map();

  ctx.sql.push(keyword);
  if (q.q.hookSelect || hookSelect) {
    const tempSelect: HookSelect = new Map(q.q.hookSelect);
    if (hookSelect) {
      for (const column of hookSelect) {
        tempSelect.set(column, { select: column });
      }
    }
    ctx.sql.push(selectToSql(ctx, q, data, quotedAs, tempSelect));
    return tempSelect;
  } else if (select) {
    ctx.sql.push(selectToSql(ctx, q, data, quotedAs));
  }

  return;
};
