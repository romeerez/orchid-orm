import { quoteSchemaAndTable } from './common';
import { makeReturningSql } from './insert';
import { pushWhereStatementSql, whereToSql } from './where';
import { pushLimitSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import { QueryData, UpdateQueryDataItem, UpdateQueryDataObject } from './data';
import {
  addValue,
  DelayedRelationSelect,
  emptyObject,
  isExpression,
  newDelayedRelationSelect,
  pushOrNewArray,
  RecordUnknown,
  Sql,
} from 'orchid-core';
import { Db } from '../query/db';
import { joinSubQuery } from '../common/utils';
import { selectToSql } from './select';
import { countSelect } from './rawSql';
import { getSqlText } from './utils';
import { Query } from '../query/query';
import { processJoinItem } from './join';

export const pushUpdateSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryData,
  quotedAs: string,
  isSubSql?: boolean,
): Sql => {
  const quotedTable = quoteSchemaAndTable(
    query.schema,
    table.table || (query.from as string),
  );

  let hookSet: RecordUnknown;
  if (query.hookUpdateSet) {
    hookSet = {};
    for (const item of query.hookUpdateSet) {
      Object.assign(hookSet, item);
    }
  } else {
    hookSet = emptyObject;
  }

  const set: string[] = [];
  processData(ctx, table, set, query.updateData, hookSet, quotedAs);

  if (query.hookUpdateSet) {
    applySet(ctx, table, set, hookSet, emptyObject, quotedAs);
  }

  let tableHook;
  const delayedRelationSelect: DelayedRelationSelect | undefined =
    query.selectRelation ? newDelayedRelationSelect(table) : undefined;

  // if no values to set, make a `SELECT` query
  if (!set.length) {
    if (!query.select) {
      query.select = countSelect;
    }

    tableHook = pushUpdateReturning(
      ctx,
      table,
      query,
      quotedAs,
      'SELECT',
      delayedRelationSelect,
      isSubSql,
    );

    ctx.sql.push(`FROM ${quotedTable}`);
    pushWhereStatementSql(ctx, table, query, quotedAs);
    pushLimitSQL(ctx.sql, ctx.values, query);
  } else {
    ctx.sql.push(`UPDATE ${quotedTable}`);

    if (quotedTable !== quotedAs) {
      ctx.sql.push(quotedAs);
    }

    ctx.sql.push('SET');
    ctx.sql.push(set.join(', '));

    const { updateFrom } = query;
    let fromWhereSql: string | undefined;
    if (updateFrom) {
      const { target, on } = processJoinItem(
        ctx,
        table,
        query,
        updateFrom,
        quotedAs,
      );

      ctx.sql.push(`FROM ${target}`);

      fromWhereSql = on;

      if (query.join) {
        const joinSet = query.join.length > 1 ? new Set<string>() : null;

        for (const item of query.join) {
          const { target, on } = processJoinItem(
            ctx,
            table,
            query,
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

    const mainWhereSql = whereToSql(ctx, table, query, quotedAs);
    const whereSql = mainWhereSql
      ? fromWhereSql
        ? mainWhereSql + ' AND ' + fromWhereSql
        : mainWhereSql
      : fromWhereSql;
    if (whereSql) {
      ctx.sql.push('WHERE', whereSql);
    }

    tableHook = pushUpdateReturning(
      ctx,
      table,
      query,
      quotedAs,
      'RETURNING',
      delayedRelationSelect,
      isSubSql,
    );
  }

  return {
    tableHook,
    delayedRelationSelect,
    text: ctx.sql.join(' '),
    values: ctx.values,
  };
};

const pushUpdateReturning = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: QueryData,
  quotedAs: string,
  keyword: string,
  delayedRelationSelect: DelayedRelationSelect | undefined,
  isSubSql?: boolean,
) => {
  const { inCTE } = query;
  const { select, tableHook } = makeReturningSql(
    ctx,
    table,
    query,
    quotedAs,
    delayedRelationSelect,
    'Update',
    inCTE && 'Create',
    isSubSql,
  );

  const s =
    inCTE && (inCTE.selectNum || !select)
      ? select
        ? '0, ' + select
        : '0'
      : select;
  if (s) ctx.sql.push(keyword, s);

  return tableHook;
};

const processData = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
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
      applySet(ctx, table, set, item, hookSet, quotedAs);
    }
  }

  if (append) processData(ctx, table, set, append, hookSet, quotedAs);
};

const applySet = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  set: string[],
  item: UpdateQueryDataObject,
  hookSet: RecordUnknown,
  quotedAs?: string,
) => {
  const QueryClass = ctx.qb.constructor as unknown as Db;
  const shape = table.q.shape;

  for (const key in item) {
    const value = item[key];
    if (value === undefined || key in hookSet) continue;

    set.push(
      `"${shape[key].data.name || key}" = ${processValue(
        ctx,
        table,
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
  table: ToSQLQuery,
  QueryClass: Db,
  key: string,
  value: UpdateQueryDataObject[string],
  quotedAs?: string,
) => {
  if (value && typeof value === 'object') {
    if (isExpression(value)) {
      return value.toSQL(ctx, quotedAs);
    } else if (value instanceof (QueryClass as never)) {
      if ((value as Query).q.subQuery === 1) {
        return selectToSql(ctx, table, (value as Query).q, quotedAs);
      }

      return `(${getSqlText(
        joinSubQuery(table, value as ToSQLQuery).toSQL(ctx),
      )})`;
    } else if ('op' in value && 'arg' in value) {
      return `"${table.q.shape[key].data.name || key}" ${
        (value as { op: string }).op
      } ${addValue(ctx.values, (value as { arg: unknown }).arg)}`;
    }
  }

  return addValue(ctx.values, value);
};
