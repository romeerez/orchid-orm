import { getRaw, isRaw } from '../common';
import { quoteSchemaAndTable } from './common';
import { QueryBase } from '../query';
import { queryKeysOfNotSimpleQuery, SelectQueryData } from './types';
import { ToSqlCtx } from './toSql';

export const pushFromAndAs = (
  ctx: ToSqlCtx,
  model: QueryBase,
  query: SelectQueryData,
  quotedAs?: string,
) => {
  ctx.sql.push('FROM');
  if (query.fromOnly) ctx.sql.push('ONLY');

  const from = getFrom(model, query, ctx.values);
  ctx.sql.push(from);

  if (query.as && quotedAs && quotedAs !== from) {
    ctx.sql.push('AS', quotedAs as string);
  }
};

const getFrom = (
  model: QueryBase,
  query: SelectQueryData,
  values: unknown[],
) => {
  if (query.from) {
    if (typeof query.from === 'object') {
      if (isRaw(query.from)) {
        return getRaw(query.from, values);
      }

      if (!query.from.table) {
        const sql = query.from.toSql(values);
        return `(${sql.text})`;
      }

      const q = query.from.query;
      const keys = Object.keys(q) as (keyof SelectQueryData)[];
      // if query contains more than just schema return (SELECT ...)
      if (keys.some((key) => queryKeysOfNotSimpleQuery.includes(key))) {
        const sql = query.from.toSql(values);
        return `(${sql.text})`;
      }

      return quoteSchemaAndTable(q.schema, query.from.table);
    }

    return quoteSchemaAndTable(query.schema, query.from);
  }

  return quoteSchemaAndTable(query.schema, model.table as string);
};
