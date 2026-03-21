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
import { processJoinItem } from '../join/join.sql';
import { moveMutativeQueryToCte, setFreeTopCteAs } from '../cte/cte.sql';
import { SubQueryForSql } from '../../sub-query/sub-query-for-sql';
import { pushLimitSQL } from '../limit-offset/limit-offset.sql';
import { makeSql, quoteTableWithSchema, Sql } from '../../sql/sql';
import {
  addValue,
  emptyObject,
  pushOrNewArray,
  RecordUnknown,
} from '../../../utils';
import {
  DelayedRelationSelect,
  newDelayedRelationSelect,
} from '../select/delayed-relational-select';
import { isExpression } from '../../expressions/expression';
import { OrchidOrmInternalError } from '../../errors';
import { Column } from '../../../columns/column';

export const pushUpdateSql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  if (q.updateMany) {
    return pushUpdateManySql(ctx, query, q, q.updateMany, quotedAs, isSubSql);
  }

  const quotedTable = `"${query.table || (q.from as string)}"`;
  const from = quoteTableWithSchema(query);

  let hookSet: RecordUnknown;
  if (q.hookUpdateSet) {
    hookSet = {};
    for (const item of q.hookUpdateSet) {
      Object.assign(hookSet, item);
    }
  } else {
    hookSet = emptyObject;
  }

  const set: string[] = [];
  processData(ctx, query, set, q.updateData, hookSet, quotedAs);

  if (q.hookUpdateSet) {
    applySet(ctx, query, set, hookSet, emptyObject, quotedAs);
  }

  const delayedRelationSelect: DelayedRelationSelect | undefined =
    q.selectRelation ? newDelayedRelationSelect(query) : undefined;

  // if no values to set, make a `SELECT` query
  if (!set.length) {
    if (!q.select) {
      q.select = countSelect;
    }

    pushUpdateReturning(
      ctx,
      query,
      q,
      quotedAs,
      'SELECT',
      delayedRelationSelect,
      isSubSql,
    );

    ctx.sql.push(`FROM ${from}`);
    pushWhereStatementSql(ctx, query, q, quotedAs);
    pushLimitSQL(ctx.sql, ctx.values, q);
  } else {
    ctx.sql.push(`UPDATE ${from}`);

    if (quotedTable !== quotedAs) {
      ctx.sql.push(quotedAs);
    }

    ctx.sql.push('SET');
    ctx.sql.push(set.join(', '));

    const { updateFrom } = q;
    let fromWhereSql: string | undefined;
    if (updateFrom) {
      const { target, on } = processJoinItem(
        ctx,
        query,
        q,
        updateFrom,
        quotedAs,
      );

      ctx.sql.push(`FROM ${target}`);

      fromWhereSql = on;

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
    }

    const mainWhereSql = whereToSql(ctx, query, q, quotedAs);
    const whereSql = mainWhereSql
      ? fromWhereSql
        ? mainWhereSql + ' AND ' + fromWhereSql
        : mainWhereSql
      : fromWhereSql;
    if (whereSql) {
      ctx.sql.push('WHERE', whereSql);
    }

    pushUpdateReturning(
      ctx,
      query,
      q,
      quotedAs,
      'RETURNING',
      delayedRelationSelect,
      isSubSql,
    );
  }

  if (delayedRelationSelect) {
    ctx.topCtx.delayedRelationSelect = delayedRelationSelect;
  }

  return makeSql(ctx, 'update', isSubSql);
};

const pushUpdateReturning = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  quotedAs: string,
  keyword: string,
  delayedRelationSelect: DelayedRelationSelect | undefined,
  isSubSql?: boolean,
) => {
  const returning = makeReturningSql(
    ctx,
    query,
    q,
    quotedAs,
    delayedRelationSelect,
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
  quotedAs?: string,
) => {
  let append: UpdateQueryDataItem[] | undefined;

  for (const item of data) {
    if (typeof item === 'function') {
      const result = item(data);
      if (result) append = pushOrNewArray(append, result);
    } else {
      applySet(ctx, query, set, item, hookSet, quotedAs);
    }
  }

  if (append) processData(ctx, query, set, append, hookSet, quotedAs);
};

const applySet = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  set: string[],
  item: UpdateQueryDataObject,
  hookSet: RecordUnknown,
  quotedAs?: string,
) => {
  const QueryClass = ctx.qb.constructor as unknown as Db;
  const shape = query.q.shape;

  for (const key in item) {
    const value = item[key];
    if (value === undefined || key in hookSet) continue;

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

const pushUpdateManySql = (
  ctx: ToSQLCtx,
  query: ToSQLQuery,
  q: QueryData,
  updateMany: UpdateManyQueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  const { shape } = q;
  const from = quoteTableWithSchema(query);

  // For strict variants, set up CTE infrastructure BEFORE generating SQL
  if (updateMany.strict) {
    const wrapAs = setFreeTopCteAs(ctx);
    ctx.wrapAs = wrapAs;
    const cteHooks = (ctx.topCtx.cteHooks ??= {
      hasSelect: true,
      tableHooks: {},
    });
    cteHooks.hasSelect = true;
    (cteHooks.ensureCount ??= {})[wrapAs] = updateMany.count;
  }

  // 1. Build per-row SET: "col" = "v"."col"::dataType
  const set: string[] = [];
  for (const col of updateMany.setColumns) {
    const column = shape[col] as unknown as Column;
    const dbName = column.data.name || col;
    set.push(`"${dbName}" = "v"."${dbName}"::${column.dataType}`);
  }

  // 2. Build hookSet that includes per-row setColumns + hookUpdateSet
  //    This handles per-row-wins-over-shared AND updatedAt dedup
  const hookSet: RecordUnknown = {};
  for (const col of updateMany.setColumns) hookSet[col] = true;
  if (q.hookUpdateSet) {
    for (const item of q.hookUpdateSet) Object.assign(hookSet, item);
  }

  // 3. Build shared SET from updateData (.set() + updatedAt injector)
  if (q.updateData) {
    processData(ctx, query, set, q.updateData, hookSet, quotedAs);
  }

  // 4. Build shared SET from hookUpdateSet, skipping per-row columns
  if (q.hookUpdateSet) {
    const perRowSkip: RecordUnknown = {};
    for (const col of updateMany.setColumns) perRowSkip[col] = true;
    const merged: RecordUnknown = {};
    for (const item of q.hookUpdateSet) Object.assign(merged, item);
    applySet(ctx, query, set, merged, perRowSkip, quotedAs);
  }

  // 5. Empty SET check
  if (!set.length) {
    throw new OrchidOrmInternalError(
      query as unknown as Query,
      'updateMany: no columns to set. Provide non-key columns in data or use .set()',
    );
  }

  // 6. Build FROM (VALUES ...) "v"("col1", "col2")
  const valueRows: string[] = [];
  for (const row of updateMany.values) {
    const cells: string[] = [];
    for (let i = 0; i < updateMany.columns.length; i++) {
      const col = updateMany.columns[i];
      const column = shape[col] as unknown as Column;
      const value = row[i];
      if (isExpression(value)) {
        cells.push(value.toSQL(ctx, quotedAs));
      } else {
        cells.push(addValue(ctx.values, value));
      }
      // Cast the first row's values so Postgres knows the types
      if (valueRows.length === 0 && column) {
        cells[cells.length - 1] += `::${column.dataType}`;
      }
    }
    valueRows.push(`(${cells.join(', ')})`);
  }

  const quotedColumnNames = updateMany.columns.map((col) => {
    const column = shape[col] as unknown as Column;
    return `"${column?.data.name || col}"`;
  });

  const valuesSql = `(VALUES ${valueRows.join(
    ', ',
  )}) "v"(${quotedColumnNames.join(', ')})`;

  // 7. Build WHERE: "table"."key" = "v"."key"::dataType
  const whereParts: string[] = [];
  for (const key of updateMany.keys) {
    const column = shape[key] as unknown as Column;
    const dbName = column.data.name || key;
    whereParts.push(
      `${quotedAs}."${dbName}" = "v"."${dbName}"::${column.dataType}`,
    );
  }

  // Build the UPDATE statement
  ctx.sql.push(`UPDATE ${from}`);
  if (`"${query.table || (q.from as string)}"` !== quotedAs) {
    ctx.sql.push(quotedAs);
  }
  ctx.sql.push('SET', set.join(', '));
  ctx.sql.push('FROM', valuesSql);
  ctx.sql.push('WHERE', whereParts.join(' AND '));

  // 8. Handle delayedRelationSelect
  const delayedRelationSelect: DelayedRelationSelect | undefined =
    q.selectRelation ? newDelayedRelationSelect(query) : undefined;

  // 9. RETURNING via makeReturningSql with hookPurpose: 'Update'
  const returning = makeReturningSql(
    ctx,
    query,
    q,
    quotedAs,
    delayedRelationSelect,
    'Update',
    undefined,
    isSubSql || !!ctx.topCtx.cteHooks,
  );
  if (returning) ctx.sql.push('RETURNING', returning);

  if (delayedRelationSelect) {
    ctx.topCtx.delayedRelationSelect = delayedRelationSelect;
  }

  // makeSql handles CTE wrapping automatically for type='update' when cteHooks is set
  return makeSql(ctx, 'update', isSubSql);
};
