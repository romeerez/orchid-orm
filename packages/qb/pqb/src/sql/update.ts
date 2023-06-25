import { Query } from '../query';
import { addValue, quoteSchemaAndTable } from './common';
import { pushReturningSql } from './insert';
import { pushWhereStatementSql } from './where';
import { ToSqlCtx } from './toSql';
import {
  QueryHookSelect,
  UpdateQueryData,
  UpdateQueryDataItem,
  UpdateQueryDataObject,
} from './data';
import { isExpression, pushOrNewArray } from 'orchid-core';
import { Db } from '../db';
import { joinSubQuery, resolveSubQueryCallback } from '../utils';
import { JsonItem } from './types';
import { jsonToSql } from './select';

export const pushUpdateSql = (
  ctx: ToSqlCtx,
  table: Query,
  query: UpdateQueryData,
  quotedAs: string,
): QueryHookSelect | undefined => {
  const quotedTable = quoteSchemaAndTable(query.schema, table.table as string);
  ctx.sql.push(`UPDATE ${quotedTable}`);

  if (quotedTable !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  ctx.sql.push('SET');

  const set: string[] = [];
  processData(ctx, table, set, query.updateData, quotedAs);
  ctx.sql.push(set.join(', '));

  pushWhereStatementSql(ctx, table, query, quotedAs);
  return pushReturningSql(ctx, table, query, quotedAs, query.afterUpdateSelect);
};

const processData = (
  ctx: ToSqlCtx,
  table: Query,
  set: string[],
  data: UpdateQueryDataItem[],
  quotedAs?: string,
) => {
  let append: UpdateQueryDataItem[] | undefined;
  const QueryClass = ctx.queryBuilder.constructor as Db;
  const { values } = ctx;

  for (const item of data) {
    if (typeof item === 'function') {
      const result = item(data);
      if (result) append = pushOrNewArray(append, result);
    } else if (isExpression(item)) {
      set.push(item.toSQL(values));
    } else {
      const shape = table.query.shape;
      for (const key in item) {
        const value = item[key];
        if (value === undefined) continue;

        set.push(
          `"${shape[key].data.name || key}" = ${processValue(
            table,
            values,
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
  table: Query,
  values: unknown[],
  QueryClass: Db,
  key: string,
  value: UpdateQueryDataObject[string],
  quotedAs?: string,
) => {
  if (typeof value === 'function') {
    value = resolveSubQueryCallback(table, value as (q: Query) => Query);
    if ((value as JsonItem).__json) {
      return jsonToSql(table, value as JsonItem, values, quotedAs);
    }
  }

  if (value && typeof value === 'object') {
    if (isExpression(value)) {
      return value.toSQL(values);
    } else if (value instanceof QueryClass) {
      return `(${joinSubQuery(table, value as Query).toSql({ values }).text})`;
    } else if ('op' in value && 'arg' in value) {
      return `"${table.query.shape[key].data.name || key}" ${
        (value as { op: string }).op
      } ${addValue(values, (value as { arg: unknown }).arg)}`;
    }
  }

  return addValue(values, value);
};
