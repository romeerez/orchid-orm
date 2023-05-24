import { quoteSchemaAndTable } from './common';
import { checkIfASimpleQuery } from './types';
import { makeSql, ToSqlCtx } from './toSql';
import { getRaw } from './raw';
import { SelectQueryData } from './data';
import { isRaw } from 'orchid-core';
import { QueryBase } from '../queryBase';

export const pushFromAndAs = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: SelectQueryData,
  quotedAs?: string,
) => {
  ctx.sql.push('FROM');
  if (query.fromOnly) ctx.sql.push('ONLY');

  const from = getFrom(table, query, ctx.values);
  ctx.sql.push(from);

  if (query.as && quotedAs && quotedAs !== from) {
    ctx.sql.push('AS', quotedAs);
  }
};

const getFrom = (
  table: QueryBase,
  query: SelectQueryData,
  values: unknown[],
) => {
  if (query.from) {
    const { from } = query;
    if (typeof from === 'object') {
      if (isRaw(from)) {
        return getRaw(from, values);
      }

      if (!from.table) {
        const sql = makeSql(from, { values });
        return `(${sql.text})`;
      }

      // if query contains more than just schema return (SELECT ...)
      if (!checkIfASimpleQuery(from)) {
        const sql = makeSql(from, { values });
        return `(${sql.text})`;
      }

      return quoteSchemaAndTable(from.query.schema, from.table);
    }

    return quoteSchemaAndTable(query.schema, from);
  }

  return quoteSchemaAndTable(query.schema, table.table as string);
};
