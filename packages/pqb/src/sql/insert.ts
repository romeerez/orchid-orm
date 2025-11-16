import { pushWhereStatementSql } from './where';
import { Query } from '../query/query';
import { selectToSql } from './select';
import { toSQL, ToSQLCtx, ToSQLQuery, toSubSqlText } from './toSQL';
import { InsertQueryDataObjectValues, QueryData } from './data';
import {
  addValue,
  ColumnTypeBase,
  DelayedRelationSelect,
  emptyArray,
  Expression,
  getPrimaryKeys,
  HookSelect,
  isExpression,
  newDelayedRelationSelect,
  OrchidOrmInternalError,
  pushOrNewArray,
  pushQueryValueImmutable,
  RecordUnknown,
  SingleSqlItem,
  Sql,
  TableHook,
  toArray,
} from '../core';
import { getQueryAs, joinSubQuery } from '../common/utils';
import { Db } from '../query/db';
import { RawSQL } from './rawSql';
import { OnConflictTarget, SelectAsValue, SelectItem } from './types';
import { getSqlText } from './utils';
import { MAX_BINDING_PARAMS } from './constants';
import { _clone } from '../query/queryUtils';
import { pushOrAppendWithSql, withToSql } from './with';

export const makeInsertSql = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  query: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  let { columns } = query;
  const { shape, inCTE, hookCreateSet } = query;
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

  // Save `hasNonSelect` prior passing `ctx` to `insertWith`'s `toSQL`,
  // `insertWith` queries are applied only once, need to ignore if `ctx.hasNonSelect` is changed below.
  const hasNonSelect = ctx.hasNonSelect;

  let hasWith = !!query.with;
  if (insertFrom) {
    if (values.length < 2) {
      if (query.insertWith) {
        hasWith = true;
        pushOrAppendWithSql(ctx, query, Object.values(query.insertWith).flat());
      }
    } else {
      hasWith = true;
      pushOrAppendWithSql(ctx, query, [
        {
          n: getQueryAs(insertFrom),
          q: insertFrom,
        },
      ]);
    }
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
  }

  pushWhereStatementSql(ctx, q, query, quotedAs);

  let delayedRelationSelect: DelayedRelationSelect | undefined;
  if (!inCTE) {
    delayedRelationSelect = q.q.selectRelation
      ? newDelayedRelationSelect(q)
      : undefined;
  }

  const returningPos = ctx.sql.length;

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
              q,
              QueryClass,
              values[0],
              runtimeDefaults,
              quotedAs,
            ),
          ),
        );
      }

      ctx.sql[valuesPos] = getSqlText(toSQL(q, ctx));
    } else {
      insertManyFromValuesAs = query.insertValuesAs;
      const queryAs = getQueryAs(insertFrom);
      ctx.sql[valuesPos - 1] += ` SELECT "${queryAs}".*, ${columns
        .slice(queryColumnsCount || 0)
        .map((key) => {
          const column = shape[key];
          return column
            ? `${insertManyFromValuesAs}."${column.data.name || key}"::${
                column.dataType
              }`
            : `${insertManyFromValuesAs}."${key}"`;
        })
        .join(', ')} FROM "${queryAs}",`;
    }
  }

  if (!insertFrom || insertManyFromValuesAs) {
    const valuesSql: string[] = [];
    let ctxValues = ctx.values;
    const restValuesLen = ctxValues.length;
    let currentValuesLen = restValuesLen;
    let batch: SingleSqlItem[] | undefined;
    const { insertWith } = query;
    const { skipBatchCheck } = ctx;
    const withSqls: string[] = [];
    const startingKeyword =
      (insertManyFromValuesAs ? '(' : '') + (inCTE ? 'SELECT ' : 'VALUES ');
    const valuesAppend = insertManyFromValuesAs
      ? `) ${insertManyFromValuesAs}(${quotedColumns
          .slice(queryColumnsCount || 0)
          .join(', ')})`
      : '';

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
          addWithSqls(ctx, hasWith, withSqls, valuesPos, insertSql);

          ctx.sql[valuesPos] =
            startingKeyword + valuesSql.join(', ') + valuesAppend;

          ctxValues.length = currentValuesLen;

          const returning = makeInsertReturning(
            ctx,
            q,
            query,
            quotedAs,
            delayedRelationSelect,
            isSubSql,
          );
          if (returning.select) {
            ctx.sql[returningPos] = 'RETURNING ' + returning.select;
          }

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

    addWithSqls(ctx, hasWith, withSqls, valuesPos, insertSql);

    if (batch) {
      if (hasNonSelect) {
        throw new OrchidOrmInternalError(
          q,
          `Cannot insert many records when having a non-select sub-query`,
        );
      }

      ctx.sql[valuesPos] =
        startingKeyword + valuesSql.join(', ') + valuesAppend;
      batch.push({
        text: ctx.sql.join(' '),
        values: ctxValues,
      });

      const returning = makeInsertReturning(
        ctx,
        q,
        query,
        quotedAs,
        delayedRelationSelect,
        isSubSql,
      );
      if (returning.select) {
        ctx.sql[returningPos] = 'RETURNING ' + returning.select;
      }

      return {
        tableHook: returning.tableHook,
        delayedRelationSelect,
        batch,
      };
    } else {
      ctx.sql[valuesPos] =
        startingKeyword + valuesSql.join(', ') + valuesAppend;
    }

    if (inCTE) {
      ctx.sql[valuesPos] += ' WHERE NOT EXISTS (SELECT 1 FROM "f")';
    }
  }

  const returning = makeInsertReturning(
    ctx,
    q,
    query,
    quotedAs,
    delayedRelationSelect,
    isSubSql,
  );
  if (returning.select) {
    ctx.sql[returningPos] = 'RETURNING ' + returning.select;
  }

  return {
    tableHook: returning.tableHook,
    delayedRelationSelect,
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};

const makeInsertReturning = (
  ctx: ToSQLCtx,
  q: ToSQLQuery,
  query: QueryData,
  quotedAs: string,
  delayedRelationSelect?: DelayedRelationSelect,
  isSubSql?: boolean,
) => {
  const { inCTE } = query;
  if (inCTE) {
    const select = inCTE.returning?.select;
    return {
      select:
        inCTE.selectNum || !select ? (select ? '1, ' + select : '1') : select,
      tableHook: inCTE.returning?.hookSelect && {
        select: inCTE.returning?.hookSelect,
      },
    };
  } else {
    return makeReturningSql(
      ctx,
      q,
      query,
      quotedAs,
      delayedRelationSelect,
      'Create',
      undefined,
      isSubSql,
    );
  }
};

const addWithSqls = (
  ctx: ToSQLCtx,
  hasWith: boolean,
  withSqls: string[],
  valuesPos: number,
  insertSql: string,
) => {
  if (withSqls.length) {
    if (hasWith) {
      ctx.sql[valuesPos - 2] += ',';
    }
    ctx.sql[valuesPos - 1] =
      (hasWith ? '' : 'WITH ') + withSqls.join(', ') + ' ' + insertSql;
    withSqls.length = 0;
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
  insertFrom?: Query;
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
      insertFrom = _clone(insertFrom);
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
            q,
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
              q,
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
      return `(${toSubSqlText(
        joinSubQuery(q, value as Query),
        (value as Query).q.as as string,
        ctx,
      )})`;
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
): { select?: string; tableHook?: TableHook } => {
  // inCTE is present only in upsert and orCreate
  if (data.inCTE) {
    if (hookPurpose !== 'Create') {
      const returning = makeReturningSql(
        ctx,
        q,
        data,
        quotedAs,
        delayedRelationSelect,
        'Create',
        hookPurpose,
        isSubSql,
      );

      if (returning.tableHook?.select) {
        for (const [key, value] of returning.tableHook.select) {
          data.inCTE.targetHookSelect.set(key, value);
        }
      }

      return (data.inCTE.returning = returning);
    }

    if (data.inCTE.returning) {
      return data.inCTE.returning;
    }
  }

  const hookSelect = hookPurpose && data[`after${hookPurpose}Select`];

  const { select } = data;
  if (!q.q.hookSelect && !hookSelect?.size && !select?.length && !hookPurpose) {
    const select = hookSelect && new Map();
    return {
      select: !isSubSql && ctx.cteHooks?.hasSelect ? 'NULL' : undefined,
      tableHook: select && {
        select,
      },
    };
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
      undefined,
      undefined,
      true,
      undefined,
      delayedRelationSelect,
    );
  }

  const after = hookPurpose && data[`after${hookPurpose}`];
  const afterCommit = hookPurpose && data[`after${hookPurpose}Commit`];

  return {
    select:
      !isSubSql && ctx.cteHooks?.hasSelect
        ? sql
          ? 'NULL, ' + sql
          : 'NULL'
        : sql,
    tableHook: (tempSelect || after || afterCommit) && {
      select: tempSelect,
      after:
        data.after && after
          ? [...data.after, ...after]
          : after
          ? after
          : data.after,
      afterCommit,
    },
  };
};
