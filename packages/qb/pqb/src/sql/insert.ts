import { pushWhereStatementSql } from './where';
import { Query } from '../query/query';
import { selectToSql } from './select';
import { toSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import {
  InsertQueryData,
  InsertQueryDataFromValues,
  InsertQueryDataObjectValues,
  QueryData,
} from './data';
import {
  addValue,
  ColumnTypeBase,
  Expression,
  HookSelect,
  isExpression,
  MaybeArray,
  pushOrNewArray,
  RecordUnknown,
  SingleSqlItem,
  Sql,
} from 'orchid-core';
import { joinSubQuery } from '../common/utils';
import { Db } from '../query/db';
import { RawSQL } from './rawSql';
import { OnConflictTarget, SelectAsValue, SelectItem } from './types';
import { getSqlText } from './utils';
import { MAX_BINDING_PARAMS } from './constants';
import { _clone, pushQueryValueImmutable } from '../query/queryUtils';
import { pushWithSql, withToSql } from './with';

export const makeInsertSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  query: InsertQueryData,
  quotedAs: string,
): Sql => {
  let { columns } = query;
  const { shape, inCTE, hookCreateSet } = query;
  const QueryClass = ctx.qb.constructor as unknown as Db;

  let values = query.values;

  let hookSetSql: string | undefined;
  if (hookCreateSet) {
    ({ hookSetSql, columns, values } = processHookSet(
      ctx,
      q,
      values,
      hookCreateSet,
      columns,
      QueryClass,
      quotedAs,
    ));
  }

  const quotedColumns = columns.map(
    (column) => `"${shape[column]?.data.name || column}"`,
  );

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

  if (quotedColumns.length === 0) {
    const key = Object.keys(q.shape)[0];
    if (key) {
      const column = q.shape[key] as ColumnTypeBase;
      quotedColumns[0] = `"${column?.data.name || key}"`;

      // for `create({})` case: `{}` is transformed into `[[]]`,
      // we replace it with `[[undefined]]`, and it generates SQL `VALUES (DEFAULT)`
      if (Array.isArray(values) && Array.isArray(values[0])) {
        values = values.map(() => [undefined]);
      }
    }
  }

  const insertSql = `INSERT INTO ${quotedAs}${
    quotedColumns.length ? '(' + quotedColumns.join(', ') + ')' : ''
  }`;

  if ('from' in values && query.insertWith) {
    pushWithSql(ctx, Object.values(query.insertWith).flat());
  }

  const valuesPos = ctx.sql.length + 1;
  ctx.sql.push(insertSql, null as never);

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
      const { set } = query.onConflict;
      const arr: string[] = [];
      for (const key in set) {
        const val = set[key];
        const value = isExpression(val)
          ? val.toSQL(ctx, quotedAs)
          : addValue(ctx.values, val);

        arr.push(`"${shape[key]?.data.name || key}" = ${value}`);
      }

      ctx.sql.push('DO UPDATE SET', arr.join(', '));
    } else {
      ctx.sql.push('DO NOTHING');
    }
  }

  pushWhereStatementSql(ctx, q, query, quotedAs);

  let returning;
  if (inCTE) {
    const select = inCTE.returning?.select;
    returning = {
      select:
        inCTE.selectNum || !select ? (select ? '1, ' + select : '1') : select,
      hookSelect: inCTE.returning?.hookSelect,
    };
  } else {
    returning = makeReturningSql(ctx, q, query, quotedAs, 2);
  }

  if (returning.select) ctx.sql.push('RETURNING', returning.select);

  if ('from' in values) {
    const { from, values: v } = values as InsertQueryDataFromValues;
    const q = from.clone();

    if (v) {
      pushQueryValueImmutable(
        q,
        'select',
        new RawSQL(
          encodeRow(
            ctx,
            ctx.values,
            q,
            QueryClass,
            v,
            runtimeDefaults,
            quotedAs,
          ),
        ),
      );
    }

    ctx.sql[valuesPos] = getSqlText(toSQL(q, { values: ctx.values }));
  } else {
    const valuesSql: string[] = [];
    let ctxValues = ctx.values;
    const restValuesLen = ctxValues.length;
    let currentValuesLen = restValuesLen;
    let batch: SingleSqlItem[] | undefined;
    const { insertWith } = query;
    const { skipBatchCheck } = ctx;
    const withSqls: string[] = [];

    for (let i = 0; i < (values as InsertQueryDataObjectValues).length; i++) {
      const withes = insertWith?.[i];

      ctx.skipBatchCheck = true;
      const withSql = withes && withToSql(ctx, withes);
      ctx.skipBatchCheck = skipBatchCheck;

      let encodedRow = encodeRow(
        ctx,
        ctxValues,
        q,
        QueryClass,
        (values as InsertQueryDataObjectValues)[i],
        runtimeDefaults,
        quotedAs,
        hookSetSql,
      );

      if (!inCTE) encodedRow = '(' + encodedRow + ')';

      if (ctxValues.length > MAX_BINDING_PARAMS) {
        if (ctxValues.length - currentValuesLen > MAX_BINDING_PARAMS) {
          throw new Error(
            `Too many parameters for a single insert row, max is ${MAX_BINDING_PARAMS}`,
          );
        }

        if (!skipBatchCheck) {
          // save current batch
          if (withSqls.length) {
            ctx.sql[valuesPos - 1] =
              'WITH ' + withSqls.join(', ') + ' ' + insertSql;
            withSqls.length = 0;
          }
          ctx.sql[valuesPos] =
            (inCTE ? 'SELECT ' : 'VALUES ') + valuesSql.join(', ');
          ctxValues.length = currentValuesLen;
          batch = pushOrNewArray(batch, {
            text: ctx.sql.join(' '),
            values: ctxValues,
          });

          // reset sql and values for the next batch, repeat the last cycle
          ctxValues = ctx.values = [];
          valuesSql.length = 0;
          i--;
          continue;
        }
      }

      currentValuesLen = ctxValues.length;
      if (withSql) withSqls.push(withSql);
      valuesSql.push(encodedRow);
    }

    if (withSqls.length) {
      ctx.sql[valuesPos - 1] = 'WITH ' + withSqls.join(', ') + ' ' + insertSql;
    }

    if (batch) {
      ctx.sql[valuesPos] =
        (inCTE ? 'SELECT ' : 'VALUES ') + valuesSql.join(', ');
      batch.push({
        text: ctx.sql.join(' '),
        values: ctxValues,
      });

      return {
        hookSelect: returning.hookSelect,
        batch,
      };
    } else {
      ctx.sql[valuesPos] =
        (inCTE ? 'SELECT ' : 'VALUES ') + valuesSql.join(', ');
    }

    if (inCTE) {
      ctx.sql[valuesPos] += ' WHERE NOT EXISTS (SELECT 1 FROM "f")';
    }
  }

  return {
    hookSelect: returning.hookSelect,
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};

const processHookSet = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  values: InsertQueryDataObjectValues | InsertQueryDataFromValues,
  hookCreateSet: RecordUnknown[],
  columns: string[],
  QueryClass: Db,
  quotedAs: string,
): {
  hookSetSql?: string | undefined;
  columns: string[];
  values: InsertQueryDataObjectValues | InsertQueryDataFromValues;
} => {
  const hookSet: RecordUnknown = {};
  for (const item of hookCreateSet) {
    Object.assign(hookSet, item);
  }

  const addHookSetColumns = Object.keys(hookSet).filter(
    (key) => !columns.includes(key),
  );

  if ('from' in values) {
    const v = { ...values };
    const newColumns: string[] = [];
    const originalSelect = v.from.q.select;
    if (originalSelect) {
      v.from = _clone(v.from);
      const select: SelectItem[] = [];
      for (const s of originalSelect) {
        if (typeof s === 'string' && !hookSet[s]) {
          select.push(s);
          newColumns.push(s);
        } else if (typeof s === 'object' && 'selectAs' in s) {
          const filtered: SelectAsValue = {};
          for (const key in s.selectAs) {
            if (!hookSet[key]) {
              filtered[key] = s.selectAs[key];
              newColumns.push(key);
            }
          }
          select.push({ selectAs: filtered });
        }
      }
      v.from.q.select = select;
    }

    let row: unknown[];
    if (v.values) {
      const originalRow = v.values;
      const valuesColumns = columns.slice(-originalRow.length);
      row = [];
      valuesColumns.forEach((c, i) => {
        if (!hookSet[c]) {
          newColumns.push(c);
          row.push(originalRow[i]);
        }
      });
    } else {
      row = [];
    }

    v.values = row;

    columns.forEach((column) => {
      if (column in hookSet) {
        newColumns.push(column);

        const fromHook = {
          fromHook: encodeValue(
            ctx,
            ctx.values,
            q,
            QueryClass,
            hookSet[column],
            quotedAs,
          ),
        };
        row.push(fromHook);
      }
    });

    if (addHookSetColumns) {
      for (const key of addHookSetColumns) {
        row.push({
          fromHook: encodeValue(
            ctx,
            ctx.values,
            q,
            QueryClass,
            hookSet[key],
            quotedAs,
          ),
        });
      }

      return {
        columns: [...newColumns, ...addHookSetColumns],
        values: v,
      };
    }

    return { columns: newColumns, values: v };
  }

  columns.forEach((column, i) => {
    if (column in hookSet) {
      const fromHook = {
        fromHook: encodeValue(
          ctx,
          ctx.values,
          q,
          QueryClass,
          hookSet[column],
          quotedAs,
        ),
      };
      for (const row of values as InsertQueryDataObjectValues) {
        row[i] = fromHook;
      }
    }
  });

  const hookSetSql = addHookSetColumns
    .map((key) =>
      encodeValue(
        ctx,
        ctx.values,
        q,
        QueryClass,
        (hookSet as RecordUnknown)[key],
        quotedAs,
      ),
    )
    .join(', ');

  return {
    hookSetSql,
    columns: addHookSetColumns ? [...columns, ...addHookSetColumns] : columns,
    values,
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
    : // update whatever is the first column because DO NOTHING prevents RETURNING,
      // and we might want to return data from the insert
      `DO UPDATE SET ${quotedColumns[0]} = excluded.${quotedColumns[0]}`;
};

const encodeRow = (
  ctx: ToSQLCtx,
  values: unknown[],
  q: ToSQLQuery,
  QueryClass: Db,
  row: unknown[],
  runtimeDefaults?: (() => unknown)[],
  quotedAs?: string,
  hookSetSql?: string,
) => {
  const arr = row.map((value) =>
    encodeValue(ctx, values, q, QueryClass, value, quotedAs),
  );

  if (runtimeDefaults) {
    for (const fn of runtimeDefaults) {
      arr.push(addValue(values, fn()));
    }
  }

  if (hookSetSql) arr.push(hookSetSql);

  return arr.join(', ');
};

const encodeValue = (
  ctx: ToSQLCtx,
  values: unknown[],
  q: ToSQLQuery,
  QueryClass: Db,
  value: unknown,
  quotedAs?: string,
) => {
  if (value && typeof value === 'object') {
    if (value instanceof Expression) {
      return value.toSQL(ctx, quotedAs);
    } else if (value instanceof (QueryClass as never)) {
      return `(${getSqlText(joinSubQuery(q, value as Query).toSQL(ctx))})`;
    } else if ('fromHook' in value) {
      return value.fromHook as string;
    }
  }

  return value === undefined ? 'DEFAULT' : addValue(values, value);
};

const hookSelectKeys = [
  null,
  'afterUpdateSelect' as const,
  'afterCreateSelect' as const,
  'afterDeleteSelect' as const,
];

type QueryDataHookSelectI =
  | 1 // afterUpdateSelect
  | 2 // afterCreateSelect
  | 3; // afterDeleteSelect'

export const makeReturningSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  data: QueryData,
  quotedAs: string,
  hookSelectI?: QueryDataHookSelectI,
  addHookSelectI?: QueryDataHookSelectI,
): { select?: string; hookSelect?: HookSelect } => {
  if (data.inCTE) {
    if (hookSelectI !== 2) {
      const returning = makeReturningSql(
        ctx,
        q,
        data,
        quotedAs,
        2,
        hookSelectI,
      );

      if (returning.hookSelect) {
        for (const [key, value] of returning.hookSelect) {
          data.inCTE.targetHookSelect.set(key, value);
        }
      }

      return (data.inCTE.returning = returning);
    }

    if (data.inCTE.returning) {
      return data.inCTE.returning;
    }
  }

  const hookSelect = hookSelectI && data[hookSelectKeys[hookSelectI]!];

  const { select } = data;
  if (
    !q.q.hookSelect &&
    !hookSelect?.size &&
    !select?.length &&
    !addHookSelectI
  ) {
    return { hookSelect: hookSelect && new Map() };
  }

  const otherCTEHookSelect =
    addHookSelectI && data[hookSelectKeys[addHookSelectI]!];

  let tempSelect: HookSelect | undefined;
  if (q.q.hookSelect || hookSelect || otherCTEHookSelect) {
    tempSelect = new Map(q.q.hookSelect);

    if (hookSelect) {
      for (const column of hookSelect) {
        tempSelect.set(column, { select: column });
      }
    }

    if (otherCTEHookSelect) {
      for (const column of otherCTEHookSelect) {
        tempSelect.set(column, { select: column });
      }
    }
  }

  let sql: string | undefined;
  if (tempSelect?.size || select?.length) {
    sql = selectToSql(ctx, q, data, quotedAs, tempSelect, undefined, true);
  }

  return { select: sql, hookSelect: tempSelect };
};
