import { Query } from '../query';
import { addValue, q, quoteSchemaAndTable } from './common';
import { pushReturningSql } from './insert';
import { pushWhereStatementSql } from './where';
import { ToSqlCtx } from './toSql';
import { getRaw } from '../raw';
import {
  UpdateQueryData,
  UpdateQueryDataItem,
  UpdateQueryDataObject,
} from './data';
import { isRaw, pushOrNewArray } from 'orchid-core';

export const pushUpdateSql = (
  ctx: ToSqlCtx,
  table: Query,
  query: UpdateQueryData,
  quotedAs: string,
) => {
  const quotedTable = quoteSchemaAndTable(query.schema, table.table as string);
  ctx.sql.push(`UPDATE ${quotedTable}`);

  if (quotedTable !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  ctx.sql.push('SET');

  const set: string[] = [];
  processData(ctx, table, set, query.updateData);
  ctx.sql.push(set.join(', '));

  pushWhereStatementSql(ctx, table, query, quotedAs);
  pushReturningSql(ctx, table, query, quotedAs);
};

const processData = (
  ctx: ToSqlCtx,
  table: Query,
  set: string[],
  data: UpdateQueryDataItem[],
) => {
  let append: UpdateQueryDataItem[] | undefined;
  data.forEach((item) => {
    if (typeof item === 'function') {
      const result = item(data);
      if (result) append = pushOrNewArray(append, result);
    } else if (isRaw(item)) {
      set.push(getRaw(item, ctx.values));
    } else {
      const shape = table.query.shape;
      for (const key in item) {
        const value = item[key];
        if (value !== undefined) {
          set.push(
            `${q(shape[key].data.name || key)} = ${processValue(
              table,
              ctx.values,
              key,
              value,
            )}`,
          );
        }
      }
    }
  });

  if (append) processData(ctx, table, set, append);
};

const processValue = (
  table: Query,
  values: unknown[],
  key: string,
  value: UpdateQueryDataObject[string],
) => {
  if (value && typeof value === 'object') {
    if (isRaw(value)) {
      return getRaw(value, values);
    } else if ('op' in value && 'arg' in value) {
      return `${q(table.query.shape[key].data.name || key)} ${
        (value as { op: string }).op
      } ${addValue(values, (value as { arg: unknown }).arg)}`;
    }
  }

  return addValue(values, value);
};
