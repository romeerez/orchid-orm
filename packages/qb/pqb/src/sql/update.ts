import { quoteSchemaAndTable } from './common';
import { makeReturningSql } from './insert';
import { pushWhereStatementSql } from './where';
import { pushLimitSQL, ToSQLCtx, ToSQLQuery } from './toSQL';
import {
  SelectQueryData,
  UpdateQueryData,
  UpdateQueryDataItem,
  UpdateQueryDataObject,
} from './data';
import {
  addValue,
  emptyObject,
  HookSelect,
  isExpression,
  pushOrNewArray,
  RecordUnknown,
} from 'orchid-core';
import { Db } from '../query/db';
import { joinSubQuery } from '../common/utils';
import { selectToSql } from './select';
import { countSelect } from './rawSql';
import { getSqlText } from './utils';
import { Query } from '../query/query';

export const pushUpdateSql = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: UpdateQueryData,
  quotedAs: string,
): HookSelect | undefined => {
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

  // if no values to set, make a `SELECT` query
  if (!set.length) {
    if (!query.select) {
      query.select = countSelect;
    }

    const hookSelect = pushUpdateReturning(
      ctx,
      table,
      query,
      quotedAs,
      'SELECT',
    );

    ctx.sql.push(`FROM ${quotedTable}`);
    pushWhereStatementSql(ctx, table, query, quotedAs);
    pushLimitSQL(ctx.sql, ctx.values, query as unknown as SelectQueryData);

    return hookSelect;
  }

  ctx.sql.push(`UPDATE ${quotedTable}`);

  if (quotedTable !== quotedAs) {
    ctx.sql.push(quotedAs);
  }

  ctx.sql.push('SET');
  ctx.sql.push(set.join(', '));

  pushWhereStatementSql(ctx, table, query, quotedAs);

  return pushUpdateReturning(ctx, table, query, quotedAs, 'RETURNING');
};

const pushUpdateReturning = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  query: UpdateQueryData,
  quotedAs: string,
  keyword: string,
) => {
  const { inCTE } = query;
  const { select, hookSelect } = makeReturningSql(
    ctx,
    table,
    query,
    quotedAs,
    1,
    inCTE && 2,
  );

  const s =
    inCTE && (inCTE.selectNum || !select)
      ? select
        ? '0, ' + select
        : '0'
      : select;
  if (s) ctx.sql.push(keyword, s);

  return hookSelect;
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
