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
  HookSelect,
  isExpression,
  pushOrNewArray,
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
  const quotedTable = quoteSchemaAndTable(query.schema, table.table as string);

  const set: string[] = [];
  processData(ctx, table, set, query.updateData, quotedAs);

  // if no values to set, make an `SELECT` query
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
    ctx.sql.push(`AS ${quotedAs}`);
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

  const s = inCTE?.selectNum ? (select ? '0, ' + select : '0') : select;
  if (s) ctx.sql.push(keyword, s);

  return hookSelect;
};

const processData = (
  ctx: ToSQLCtx,
  table: ToSQLQuery,
  set: string[],
  data: UpdateQueryDataItem[],
  quotedAs?: string,
) => {
  let append: UpdateQueryDataItem[] | undefined;
  const QueryClass = ctx.queryBuilder.constructor as unknown as Db;

  for (const item of data) {
    if (typeof item === 'function') {
      const result = item(data);
      if (result) append = pushOrNewArray(append, result);
    } else if (isExpression(item)) {
      set.push(item.toSQL(ctx, quotedAs));
    } else {
      const shape = table.q.shape;
      for (const key in item) {
        const value = item[key];
        if (value === undefined) continue;

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
    }
  }

  if (append) processData(ctx, table, set, append, quotedAs);
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
