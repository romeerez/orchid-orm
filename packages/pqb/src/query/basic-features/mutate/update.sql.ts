import { makeReturningSql } from './insert.sql';
import { pushWhereStatementSql, whereToSql } from '../where/where.sql';
import { ToSQLCtx, ToSQLQuery } from '../../sql/to-sql';
import {
  QueryData,
  UpdateManyQueryData,
  UpdateQueryDataItem,
  UpdateQueryDataObject,
} from '../../query-data';
import { Db } from '../../db';
import { selectToSql } from '../select/select.sql';
import { countSelect } from '../../expressions/raw-sql';
import { Query } from '../../query';
import { JoinItemArgs, processJoinItem } from '../join/join.sql';
import { moveMutativeQueryToCte, setFreeTopCteAs } from '../cte/cte.sql';
import { SubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { pushLimitSQL } from '../limit-offset/limit-offset.sql';
import { makeSql, quoteTableWithSchema, Sql } from '../../sql/sql';
import {
  addValue,
  emptyObject,
  pushOrNewArray,
  RecordUnknown,
} from '../../../utils';
import { isExpression } from '../../expressions/expression';
import { throwOnReadOnlyUpdate } from '../../query.utils';
import { OrchidOrmInternalError } from '../../errors';
import { ensureCTECount } from '../../extra-features/hooks/hooks.sql';
import {
  MutativeQueriesSelectRelationsSqlState,
  newMutativeQueriesSelectRelationsSqlState,
  handleInsertAndUpdateSelectRelationsSqlState,
} from '../../internal-features/mutative-queries-select-relation/mutative-queries-select-relations.sql';

export const pushUpdateSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  const quotedTable = `"${query.table || (q.from as string)}"`;
  const from = quoteTableWithSchema(query);

  const set: string[] = [];

  const hookSet = q.hookUpdateSet
    ? Object.fromEntries(
        q.hookUpdateSet.flatMap((item) => Object.entries(item)),
      )
    : emptyObject;

  const relationSelectState = newMutativeQueriesSelectRelationsSqlState(query);

  // User can use `set({ key: 'value' })` multiple times,
  // `usedSetKeys` is here to track what keys were already added to SQL to not add them twice.
  const usedSetKeys = new Set<string>();

  // Applies `hookSet`: key-values that should be set by the update hooks.
  // Adds SQL key-value pairs into `set` array.
  // Must be applied before other `set` data: the earlier one takes precedence.
  if (q.hookUpdateSet) {
    applySet(ctx, query, set, hookSet, emptyObject, usedSetKeys, quotedAs);
  }

  // updateData is array of update sets that's coming from `set`, `updateMany`, also `timestamps` logic are adding to it,
  // `processData` processes it into `set` array of SQL strings for key-value pairs.
  if (q.updateData) {
    processData(ctx, query, set, q.updateData, hookSet, usedSetKeys, quotedAs);
  }

  let updateManyValuesSql;
  if (q.updateMany) {
    for (const key of q.updateMany.primaryKeys) {
      usedSetKeys.add(key);
    }

    updateManyValuesSql = makeUpdateManyValuesSql(
      ctx,
      query,
      q,
      q.updateMany,
      set,
      usedSetKeys,
      quotedAs,
    );
  }

  // If nothing to set, make a SELECT query
  if (!set.length) {
    pushSelectForEmptySet(
      ctx,
      query,
      q,
      quotedAs,
      from,
      isSubSql,
      updateManyValuesSql,
      relationSelectState,
    );
  } else {
    ctx.sql.push(`UPDATE ${from}`);

    if (quotedTable !== quotedAs) {
      ctx.sql.push(quotedAs);
    }

    ctx.sql.push('SET', set.join(', '));

    let fromWhereSql;

    if (updateManyValuesSql) {
      if (q.updateMany?.strict) {
        addUpdateManyCteForStrict(ctx, q.updateMany);
      }

      ctx.sql.push('FROM', updateManyValuesSql);
    } else if (q.updateFrom) {
      fromWhereSql = pushUpdateFromSql(ctx, query, q, quotedAs, q.updateFrom);
    }

    pushUpdateWhereSql(ctx, query, q, quotedAs, fromWhereSql);

    pushUpdateReturning(
      ctx,
      query,
      q,
      quotedAs,
      'RETURNING',
      relationSelectState,
      isSubSql,
    );
  }

  handleInsertAndUpdateSelectRelationsSqlState(ctx, relationSelectState);

  return makeSql(ctx, 'update', isSubSql);
};

const pushSelectForEmptySet = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  from: string,
  isSubSql?: boolean,
  updateManyValuesSql?: string,
  relationSelectState?: MutativeQueriesSelectRelationsSqlState,
) => {
  if (!q.select) {
    q.select = countSelect;
  }

  pushUpdateReturning(
    ctx,
    query,
    q,
    quotedAs,
    'SELECT',
    relationSelectState,
    isSubSql,
  );

  let fromSql = `FROM ${from}`;

  if (updateManyValuesSql) {
    fromSql += `, ${updateManyValuesSql}`;
  }

  ctx.sql.push(fromSql);
  pushWhereStatementSql(ctx, query, q, quotedAs);
  pushLimitSQL(ctx.sql, ctx.values, q);
};

// For strict variants, set up CTE infrastructure
const addUpdateManyCteForStrict = (
  ctx: ToSQLCtx,
  updateMany: UpdateManyQueryData,
) => {
  const wrapAs = setFreeTopCteAs(ctx);
  ctx.wrapAs = wrapAs;
  ensureCTECount(ctx, wrapAs, { count: updateMany.data.length });
};

const pushUpdateFromSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  updateFrom: JoinItemArgs,
): string | undefined => {
  const { target, on } = processJoinItem(ctx, query, q, updateFrom, quotedAs);

  ctx.sql.push(`FROM ${target}`);

  let fromWhereSql = on;

  if (q.join) {
    const joinSet = q.join.length > 1 ? new Set<string>() : null;

    for (const item of q.join) {
      const { target, on } = processJoinItem(
        ctx,
        query,
        q,
        item.args,
        quotedAs,
      );

      if (joinSet) {
        const key = `${item.type}${target}${on}`;
        if (joinSet.has(key)) continue;
        joinSet.add(key);
      }

      ctx.sql.push(`${item.type} ${target} ON true`);

      if (on) {
        fromWhereSql = fromWhereSql ? fromWhereSql + ' AND ' + on : on;
      }
    }
  }

  return fromWhereSql;
};

const pushUpdateWhereSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  fromWhereSql?: string,
): void => {
  const mainWhereSql = whereToSql(ctx, query, q, quotedAs);
  const whereSql = mainWhereSql
    ? fromWhereSql
      ? mainWhereSql + ' AND ' + fromWhereSql
      : mainWhereSql
    : fromWhereSql;
  if (whereSql) {
    ctx.sql.push('WHERE', whereSql);
  }
};

const pushUpdateReturning = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  keyword: string,
  relationSelectState: MutativeQueriesSelectRelationsSqlState | undefined,
  isSubSql?: boolean,
) => {
  const returning = makeReturningSql(
    ctx,
    query,
    q,
    quotedAs,
    relationSelectState,
    'Update',
    undefined,
    isSubSql,
  );

  if (returning) ctx.sql.push(keyword, returning);
};

const processData = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  set: string[],
  data: UpdateQueryDataItem[],
  hookSet: RecordUnknown,
  usedSetKeys: Set<string>,
  quotedAs?: string,
) => {
  let append: UpdateQueryDataItem[] | undefined;

  for (let i = data.length - 1; i >= 0; i--) {
    const item = data[i];
    if (typeof item === 'function') {
      const result = item(data);
      if (result) append = pushOrNewArray(append, result);
    } else {
      applySet(ctx, query, set, item, hookSet, usedSetKeys, quotedAs);
    }
  }

  if (append) {
    processData(ctx, query, set, append, hookSet, usedSetKeys, quotedAs);
  }
};

const applySet = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  set: string[],
  item: UpdateQueryDataObject,
  skipColumns: RecordUnknown,
  usedSetKeys: Set<string>,
  quotedAs?: string,
) => {
  const QueryClass = ctx.qb.constructor as unknown as Db;
  const shape = query.q.shape;

  for (const key in item) {
    if (usedSetKeys.has(key)) {
      continue;
    }

    usedSetKeys.add(key);

    const value = item[key];
    if (value === undefined || key in skipColumns) continue;

    set.push(
      `"${shape[key].data.name || key}" = ${processValue(
        ctx,
        query,
        QueryClass,
        key,
        value,
        quotedAs,
      )}`,
    );
  }
};

const processValue = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  QueryClass: Db,
  key: string,
  value: UpdateQueryDataObject[string],
  quotedAs?: string,
) => {
  if (value && typeof value === 'object') {
    if (isExpression(value)) {
      return value.toSQL(ctx, quotedAs);
    } else if (value instanceof (QueryClass as never)) {
      const subQuery = value as Query;
      if (subQuery.q.subQuery === 1) {
        return selectToSql(ctx, query, subQuery.q, quotedAs);
      }

      return `(${moveMutativeQueryToCte(
        ctx,
        subQuery as unknown as SubQueryForSql,
      )})`;
    } else if ('op' in value && 'arg' in value) {
      return `"${query.q.shape[key].data.name || key}" ${
        (value as { op: string }).op
      } ${addValue(ctx.values, (value as { arg: unknown }).arg)}`;
    }
  }

  return addValue(ctx.values, value);
};

// Build FROM (VALUES ...) "v"("col1", "col2")
const makeUpdateManyValuesSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  updateMany: UpdateManyQueryData,
  set: string[],
  usedSetKeys: Set<string>,
  quotedAs: string,
) => {
  const { shape } = q;

  const keysSet = new Set<string>();
  const valueRows: string[] = [];
  const quotedColumnNames: string[] = [];
  const { data } = updateMany;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const cells: string[] = [];
    let keysInRow = 0;

    for (const key in row) {
      let value = row[key];
      if (value === undefined) {
        continue;
      }

      const column = shape[key];
      const columnName = column.data.name || key;

      if (column.data.virtual) continue;
      throwOnReadOnlyUpdate(query, column, key);

      keysInRow++;

      if (isExpression(value)) {
        cells.push(value.toSQL(ctx, quotedAs));
      } else {
        if (column.data.encode && value !== null) {
          value = column.data.encode(value);
        }

        cells.push(addValue(ctx.values, value));
      }

      // Cast the first VALUES row so Postgres can infer column types,
      // and collect the alias column names once.
      if (i === 0) {
        keysSet.add(key);
        cells[cells.length - 1] += `::${column.dataType}`;
        quotedColumnNames.push(`"${columnName}"`);

        if (!usedSetKeys.has(key)) {
          set.push(`"${shape[key].data.name || key}" = "v"."${columnName}"`);
        }
      } else if (!keysSet.has(key)) {
        throwOnDifferentColumns(query, keysSet, row, i);
      }
    }

    if (keysInRow < keysSet.size) {
      throwOnDifferentColumns(query, keysSet, row, i);
    }

    valueRows.push(`(${cells.join(', ')})`);
  }

  return `(VALUES ${valueRows.join(', ')}) "v"(${quotedColumnNames.join(
    ', ',
  )})`;
};

const throwOnDifferentColumns = (
  query: ToSQLQuery,
  keysSet: Set<string>,
  row: RecordUnknown,
  i: number,
) => {
  throw new OrchidOrmInternalError(
    query,
    `Row ${i} has different columns than row 0. Expected: [${[...keysSet].join(
      ', ',
    )}], got: [${Object.keys(row).join(', ')}]`,
  );
};
