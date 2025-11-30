import { pushWhereStatementSql } from './where';
import { selectToSql } from './select';
import { ToSQLCtx, ToSQLQuery } from './to-sql';
import { InsertQueryDataObjectValues, QueryData } from './data';
import {
  addValue,
  DelayedRelationSelect,
  emptyArray,
  Expression,
  getFreeAlias,
  getPrimaryKeys,
  HookSelect,
  isExpression,
  isRelationQuery,
  newDelayedRelationSelect,
  OrchidOrmInternalError,
  pushOrNewArray,
  pushQueryValueImmutable,
  RecordUnknown,
  SingleSqlItem,
  Sql,
  toArray,
} from '../core';
import { getQueryAs } from '../common/utils';
import { Db } from '../query/db';
import { RawSQL } from './rawSql';
import { OnConflictTarget, SelectAsValue, SelectItem } from './types';
import { MAX_BINDING_PARAMS } from './constants';
import { _clone } from '../query/queryUtils';
import {
  getTopCteSize,
  setTopCteSize,
  composeCteSingleSql,
  moveMutativeQueryToCte,
} from '../query/cte/cte.sql';
import { Column } from '../columns/column';
import { addTableHook } from '../query/hooks/hooks.sql';
import { SubQueryForSql } from '../query/to-sql/sub-query-for-sql';
import { moveQueryToCte } from '../query/cte/move-mutative-query-to-cte-base.sql';

interface InsertSqlState {
  ctx: ToSQLCtx;
  q: ToSQLQuery;
  query: QueryData;
  quotedAs: string;
  isSubSql?: boolean;
  delayedRelationSelect?: DelayedRelationSelect;
  returningPos: number;
  insertSql: string;
  selectFromSql?: string;
}

interface InsertValuesSqlState extends InsertSqlState {
  valuesPrepend: string;
  valuesSql: string[];
  valuesAppend: string;
}

export const makeInsertSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  query: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  let { columns } = query;
  const { shape, hookCreateSet } = query;
  const QueryClass = ctx.qb.constructor as unknown as Db;

  let { insertFrom, queryColumnsCount, values } = query;

  let hookSetSql: string | undefined;
  if (hookCreateSet) {
    ({ hookSetSql, columns, insertFrom, queryColumnsCount, values } =
      processHookSet(
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
  let runtimeDefaultColumns: string[] | undefined;
  if (q.internal.runtimeDefaultColumns) {
    runtimeDefaults = [];
    runtimeDefaultColumns = [];
    for (const key of q.internal.runtimeDefaultColumns) {
      if (!columns.includes(key)) {
        const column = shape[key];
        columns.push(key);
        quotedColumns.push(`"${column.data.name || key}"`);
        runtimeDefaults.push(column.data.runtimeDefault as () => unknown);
        runtimeDefaultColumns.push(key);
      }
    }
  }

  if (quotedColumns.length === 0) {
    const key = Object.keys(q.shape)[0];
    if (key) {
      const column = q.shape[key] as unknown as Column.Pick.Data;
      quotedColumns[0] = `"${column?.data.name || key}"`;

      // for `create({})` case: `{}` is transformed into `[[]]`,
      // we replace it with `[[undefined]]`, and it generates SQL `VALUES (DEFAULT)`
      if (Array.isArray(values) && Array.isArray(values[0])) {
        values = values.map(() => [undefined]);
      }
    }
  }

  // `insertWith` queries are applied only once, need to ignore if `ctx.hasNonSelect` is changed below.
  const hasNonSelect = ctx.hasNonSelect;

  const sqlState: InsertSqlState = {
    ctx,
    q,
    query,
    quotedAs,
    isSubSql,
    returningPos: 0,
    insertSql: `INSERT INTO ${quotedAs}${
      quotedColumns.length ? '(' + quotedColumns.join(', ') + ')' : ''
    }`,
  };
  ctx.sql.push(null as never, null as never);

  pushOnConflictSql(ctx, query, quotedAs, columns, quotedColumns);

  const upsert = query.type === 'upsert';

  if (upsert || (insertFrom && !isRelationQuery(q)) || query.onConflict) {
    pushWhereStatementSql(ctx, q, query, quotedAs);
  }

  sqlState.delayedRelationSelect = q.q.selectRelation
    ? newDelayedRelationSelect(q)
    : undefined;

  sqlState.returningPos = ctx.sql.length;

  let insertManyFromValuesAs: string | undefined;
  if (insertFrom) {
    if (values.length < 2) {
      const q = insertFrom.clone();

      if (values[0]?.length) {
        pushQueryValueImmutable(
          q,
          'select',
          new RawSQL(
            encodeRow(
              ctx,
              ctx.values,
              QueryClass,
              values[0],
              runtimeDefaults,
              quotedAs,
            ),
          ),
        );
      }

      ctx.sql[1] = moveMutativeQueryToCte(ctx, q);
    } else {
      const { makeSelectList } = moveQueryToCte(
        ctx,
        insertFrom,
        getQueryAs(insertFrom),
      );

      const selectList = makeSelectList(true);

      insertManyFromValuesAs = query.insertValuesAs;
      selectList.push(
        ...columns.slice(queryColumnsCount || 0).map((key) => {
          const column = shape[key];
          return column
            ? `${insertManyFromValuesAs}."${column.data.name || key}"::${
                column.dataType
              }`
            : `${insertManyFromValuesAs}."${key}"`;
        }),
      );

      const queryAs = getQueryAs(insertFrom);
      sqlState.selectFromSql = ` SELECT ${selectList.join(
        ', ',
      )} FROM "${queryAs}",`;
    }
  }

  if (!insertFrom || insertManyFromValuesAs) {
    const valuesSqlState = sqlState as InsertValuesSqlState;
    valuesSqlState.valuesSql = [];
    valuesSqlState.valuesPrepend =
      (insertManyFromValuesAs ? '(' : '') + (upsert ? 'SELECT ' : 'VALUES ');
    valuesSqlState.valuesAppend = insertManyFromValuesAs
      ? `) ${insertManyFromValuesAs}(${quotedColumns
          .slice(queryColumnsCount || 0)
          .join(', ')})`
      : '';

    let ctxValues = ctx.values;
    const restValuesLen = ctxValues.length;
    let currentValuesLen = restValuesLen;
    let batch: SingleSqlItem[] | undefined;
    const { skipBatchCheck } = ctx;

    for (let i = 0; i < (values as InsertQueryDataObjectValues).length; i++) {
      const topCteSize = getTopCteSize(ctx);

      ctx.skipBatchCheck = true;

      let encodedRow = encodeRow(
        ctx,
        ctxValues,
        QueryClass,
        (values as InsertQueryDataObjectValues)[i],
        runtimeDefaults,
        quotedAs,
        hookSetSql,
      );
      ctx.skipBatchCheck = skipBatchCheck;

      if (!upsert) encodedRow = '(' + encodedRow + ')';

      if (ctxValues.length > MAX_BINDING_PARAMS) {
        if (ctxValues.length - currentValuesLen > MAX_BINDING_PARAMS) {
          throw new Error(
            `Too many parameters for a single insert row, max is ${MAX_BINDING_PARAMS}`,
          );
        }

        if (!skipBatchCheck) {
          setTopCteSize(ctx, topCteSize);

          // save current batch
          applySqlState(sqlState);

          ctxValues.length = currentValuesLen;

          batch = pushOrNewArray(batch, composeCteSingleSql(ctx));

          // reset sql and values for the next batch, repeat the last cycle
          ctx.topCtx.topCTE = undefined;
          ctxValues = ctx.values = [];
          valuesSqlState.valuesSql.length = 0;
          i--;
          continue;
        }
      }

      currentValuesLen = ctxValues.length;
      valuesSqlState.valuesSql.push(encodedRow);
    }

    if (batch) {
      if (hasNonSelect) {
        throw new OrchidOrmInternalError(
          q,
          `Cannot insert many records when having a non-select sub-query`,
        );
      }

      applySqlState(sqlState);

      batch.push(composeCteSingleSql(ctx));

      if (sqlState.delayedRelationSelect) {
        ctx.topCtx.delayedRelationSelect = sqlState.delayedRelationSelect;
      }

      return {
        batch,
      };
    }
  }

  applySqlState(sqlState);

  if (sqlState.delayedRelationSelect) {
    ctx.topCtx.delayedRelationSelect = sqlState.delayedRelationSelect;
  }

  return {
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};

const pushOnConflictSql = (
  ctx: ToSQLCtx,
  query: QueryData,
  quotedAs: string,
  columns: string[],
  quotedColumns: string[],
  runtimeDefaultColumns?: string[],
): void => {
  if (!query.onConflict) return;

  const { shape } = query;

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
        sql = mergeColumnsSql(columns, quotedColumns, target, [
          ...toArray(merge.except),
          ...(runtimeDefaultColumns || emptyArray),
        ]);
      } else {
        sql = `DO UPDATE SET ${merge.reduce((sql, item, i) => {
          const name = shape[item]?.data.name || item;
          return sql + (i ? ', ' : '') + `"${name}" = excluded."${name}"`;
        }, '')}`;
      }
    } else {
      sql = mergeColumnsSql(
        columns,
        quotedColumns,
        target,
        runtimeDefaultColumns,
      );
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
};

const applySqlState = (
  sqlState: InsertSqlState | InsertValuesSqlState,
): void => {
  const { ctx } = sqlState;

  const insertSql = sqlState.selectFromSql
    ? sqlState.insertSql + sqlState.selectFromSql
    : sqlState.insertSql;

  const wrapForCteHookAs =
    !sqlState.isSubSql &&
    ctx.cteHooks &&
    getFreeAlias(sqlState.query.withShapes, 'i');

  if ('valuesSql' in sqlState) {
    ctx.sql[1] =
      sqlState.valuesPrepend +
      sqlState.valuesSql.join(', ') +
      sqlState.valuesAppend;
  }

  const returning = makeReturningSql(
    ctx,
    sqlState.q,
    sqlState.query,
    sqlState.quotedAs,
    sqlState.delayedRelationSelect,
    'Create',
    undefined,
    true,
  );

  const addNull = !sqlState.isSubSql && sqlState.ctx.cteHooks?.hasSelect;

  if (returning) {
    ctx.sql[sqlState.returningPos] = 'RETURNING ' + returning;
  }

  ctx.sql[0] = insertSql;

  if (wrapForCteHookAs) {
    (sqlState.ctx.cteSqls ??= []).push(
      wrapForCteHookAs + ' AS (' + ctx.sql.join(' ') + ')',
    );

    ctx.sql = [`SELECT *${addNull ? ', NULL' : ''} FROM ${wrapForCteHookAs}`];
  }
};

const processHookSet = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  values: InsertQueryDataObjectValues,
  hookCreateSet: RecordUnknown[],
  columns: string[],
  QueryClass: Db,
  quotedAs: string,
): {
  hookSetSql?: string | undefined;
  columns: string[];
  insertFrom?: SubQueryForSql;
  queryColumnsCount?: number;
  values: InsertQueryDataObjectValues;
} => {
  const hookSet: RecordUnknown = {};
  for (const item of hookCreateSet) {
    Object.assign(hookSet, item);
  }

  const addHookSetColumns = Object.keys(hookSet).filter(
    (key) => !columns.includes(key),
  );

  let insertFrom = q.q.insertFrom;
  if (insertFrom) {
    const newColumns = new Set<string>();
    const originalSelect = insertFrom.q.select;
    if (originalSelect) {
      insertFrom = _clone(insertFrom) as unknown as SubQueryForSql;
      const select: SelectItem[] = [];
      for (const s of originalSelect) {
        if (typeof s === 'string' && !hookSet[s]) {
          select.push(s);
          newColumns.add(s);
        } else if (typeof s === 'object' && 'selectAs' in s) {
          const filtered: SelectAsValue = {};
          for (const key in s.selectAs) {
            if (!hookSet[key]) {
              filtered[key] = s.selectAs[key];
              newColumns.add(key);
            }
          }
          select.push({ selectAs: filtered });
        }
      }
      insertFrom.q.select = select;
    }

    if (values.length) {
      const newValues: unknown[][] = [];

      const valuesColumnsSet = new Set<string>();
      values.forEach((originalRow, i) => {
        const valuesColumns = columns.slice(-originalRow.length);
        const row: unknown[] = [];
        newValues[i] = row;
        valuesColumns.forEach((c, i) => {
          if (!hookSet[c] && !newColumns.has(c)) {
            valuesColumnsSet.add(c);
            row.push(originalRow[i]);
          }
        });
      });

      for (const valueColumn of valuesColumnsSet) {
        newColumns.add(valueColumn);
      }

      values = newValues;
    } else {
      values = [[]];
    }

    columns.forEach((column) => {
      if (column in hookSet) {
        newColumns.add(column);

        const fromHook = {
          fromHook: encodeValue(
            ctx,
            ctx.values,
            QueryClass,
            hookSet[column],
            quotedAs,
          ),
        };

        for (const row of values) {
          row.push(fromHook);
        }
      }
    });

    const queryColumnsCount = insertFrom.q.select?.length;

    if (addHookSetColumns) {
      for (const key of addHookSetColumns) {
        for (const row of values) {
          row.push({
            fromHook: encodeValue(
              ctx,
              ctx.values,
              QueryClass,
              hookSet[key],
              quotedAs,
            ),
          });
        }
      }

      return {
        columns: [...newColumns, ...addHookSetColumns],
        insertFrom,
        queryColumnsCount,
        values,
      };
    }

    return { columns: [...newColumns], insertFrom, queryColumnsCount, values };
  }

  columns.forEach((column, i) => {
    if (column in hookSet) {
      const fromHook = {
        fromHook: encodeValue(
          ctx,
          ctx.values,
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
  except?: string[],
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
  QueryClass: Db,
  row: unknown[],
  runtimeDefaults?: (() => unknown)[],
  quotedAs?: string,
  hookSetSql?: string,
) => {
  const arr = row.map((value) =>
    encodeValue(ctx, values, QueryClass, value, quotedAs),
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
  QueryClass: Db,
  value: unknown,
  quotedAs?: string,
) => {
  if (value && typeof value === 'object') {
    if (value instanceof Expression) {
      return value.toSQL(ctx, quotedAs);
    } else if (value instanceof (QueryClass as never)) {
      return `(${moveMutativeQueryToCte(ctx, value as SubQueryForSql)})`;
    } else if ('fromHook' in value) {
      return value.fromHook as string;
    }
  }

  return value === undefined ? 'DEFAULT' : addValue(values, value);
};

type HookPurpose = 'Create' | 'Update' | 'Delete';

export const makeReturningSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  data: QueryData,
  quotedAs: string,
  delayedRelationSelect: DelayedRelationSelect | undefined,
  hookPurpose?: HookPurpose,
  addHookPurpose?: HookPurpose,
  isSubSql?: boolean,
): string | undefined => {
  const hookSelect = hookPurpose && data[`after${hookPurpose}Select`];

  const { select } = data;
  if (!q.q.hookSelect && !hookSelect?.size && !select?.length && !hookPurpose) {
    const select = hookSelect && new Map();

    addTableHook(ctx, q, select && { select });

    return isSubSql && ctx.cteName ? 'NULL' : undefined;
  }

  const otherCTEHookSelect =
    addHookPurpose && data[`after${addHookPurpose}Select`];

  let tempSelect: HookSelect | undefined;
  if (
    q.q.hookSelect ||
    hookSelect ||
    otherCTEHookSelect ||
    q.q.selectRelation
  ) {
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

    if (q.q.selectRelation) {
      for (const column of getPrimaryKeys(q)) {
        tempSelect.set(column, { select: column });
      }
    }
  }

  let sql: string | undefined;
  if (tempSelect?.size || select?.length) {
    sql = selectToSql(
      ctx,
      q,
      data,
      quotedAs,
      tempSelect,
      isSubSql,
      undefined,
      undefined,
      delayedRelationSelect,
    );
  }

  const after = hookPurpose && data[`after${hookPurpose}`];
  const afterCommit = hookPurpose && data[`after${hookPurpose}Commit`];

  addTableHook(
    ctx,
    q,
    (tempSelect || after || afterCommit) && {
      select: tempSelect,
      after,
      afterCommit,
    },
  );

  return sql || (isSubSql && ctx.cteName ? 'NULL' : undefined);
};
