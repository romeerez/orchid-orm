import { quoteSchemaAndTable } from './common';
import { QueryBase } from '../query';
import { checkIfASimpleQuery } from './types';
import { makeSql, ToSqlCtx } from './toSql';
import { getRaw } from '../raw';
import { SelectQueryData } from './data';
import { isRaw } from '../../../common/src/raw';

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
    ctx.sql.push('AS', quotedAs as string);
  }
};

const getFrom = (
  table: QueryBase,
  query: SelectQueryData,
  values: unknown[],
) => {
  if (query.from) {
    if (typeof query.from === 'object') {
      if (isRaw(query.from)) {
        return getRaw(query.from, values);
      }

      if (!query.from.table) {
        const sql = makeSql(query.from, { values });
        return `(${sql.text})`;
      }

      const q = query.from.query;
      // if query contains more than just schema return (SELECT ...)
      if (!checkIfASimpleQuery(q)) {
        const sql = makeSql(query.from, { values });
        return `(${sql.text})`;
      }

      return quoteSchemaAndTable(q.schema, query.from.table);
    }

    return quoteSchemaAndTable(query.schema, query.from);
  }

  return quoteSchemaAndTable(query.schema, table.table as string);
};
