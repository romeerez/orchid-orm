import { QueryBase } from '../query';
import {
  UpdateQueryData,
  UpdateQueryDataItem,
  UpdateQueryDataObject,
} from './types';
import { addValue, q, quoteSchemaAndTable } from './common';
import { getRaw, isRaw } from '../common';
import { pushReturningSql } from './insert';
import { pushWhereStatementSql } from './where';
import { ToSqlCtx } from './toSql';
import { pushOrNewArray } from '../utils';

export const pushUpdateSql = (
  ctx: ToSqlCtx,
  model: QueryBase,
  query: UpdateQueryData,
  quotedAs: string,
) => {
  const quotedTable = quoteSchemaAndTable(query.schema, model.table as string);
  ctx.sql.push(`UPDATE ${quotedTable}`);

  if (quotedTable !== quotedAs) {
    ctx.sql.push(`AS ${quotedAs}`);
  }

  ctx.sql.push('SET');

  const set: string[] = [];
  processData(ctx, set, query.updateData);
  ctx.sql.push(set.join(', '));

  pushWhereStatementSql(ctx, model, query, quotedAs);
  pushReturningSql(ctx, model, query, quotedAs);
};

const processData = (
  ctx: ToSqlCtx,
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
      for (const key in item) {
        const value = item[key];
        if (value !== undefined) {
          set.push(`${q(key)} = ${processValue(ctx.values, key, value)}`);
        }
      }
    }
  });

  if (append) processData(ctx, set, append);
};

const processValue = (
  values: unknown[],
  key: string,
  value: UpdateQueryDataObject[string],
) => {
  if (value && typeof value === 'object') {
    if (isRaw(value)) {
      return getRaw(value, values);
    } else if ('op' in value && 'arg' in value) {
      return `${q(key)} ${(value as { op: string }).op} ${addValue(
        values,
        (value as { arg: unknown }).arg,
      )}`;
    }
  }

  return addValue(values, value);
};
