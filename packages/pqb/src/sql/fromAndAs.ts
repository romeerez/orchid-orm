import { columnToSql, quoteSchemaAndTable } from './common';
import { checkIfASimpleQuery, QuerySourceItem } from './types';
import { ToSQLCtx } from './to-sql';
import { QueryData, QueryDataFromItem } from './data';
import { addValue, isExpression, IsQuery, isRawSQL, MaybeArray } from '../core';
import { Query } from '../query/query';
import { getQueryAs } from '../common/utils';
import { moveMutativeQueryToCte } from '../query/cte/cte.sql';
import { SubQueryForSql } from '../query/to-sql/sub-query-for-sql';

let fromQuery: SubQueryForSql | undefined;

export const pushFromAndAs = (
  ctx: ToSQLCtx,
  table: IsQuery,
  data: QueryData,
  quotedAs?: string,
): SubQueryForSql | undefined => {
  let sql = 'FROM ';

  const from = getFrom(ctx, table, data, quotedAs);
  sql += from;

  for (const as in data.sources) {
    const source = data.sources[as];

    const lang = getSearchLang(ctx, data, source, quotedAs);
    source.vectorSQL = getTsVector(ctx, data, lang, source, quotedAs);

    let fn;
    let query;
    if ('query' in source) {
      fn = 'websearch_to_tsquery';
      query = source.query;
    } else if ('plainQuery' in source) {
      fn = 'plainto_tsquery';
      query = source.plainQuery;
    } else if ('phraseQuery' in source) {
      fn = 'phraseto_tsquery';
      query = source.phraseQuery;
    } else {
      fn = 'to_tsquery';
      query = source.tsQuery;
    }

    let querySql;
    if (typeof query === 'string') {
      ctx.values.push(query);
      querySql = `$${ctx.values.length}`;
    } else {
      querySql = `${query.toSQL(ctx, quotedAs)}`;
    }

    sql += `, ${fn}(${lang}, ${querySql}) "${as}"`;
  }

  ctx.sql.push(sql);

  if (fromQuery) {
    const fq = fromQuery;
    fromQuery = undefined;
    return fq;
  }
  return;
};

const getFrom = (
  ctx: ToSQLCtx,
  table: IsQuery,
  data: QueryData,
  quotedAs?: string,
) => {
  fromQuery = undefined;

  if (data.from) {
    const { from } = data;
    if (Array.isArray(from)) {
      return from
        .map((item) => fromToSql(ctx, data, item, quotedAs))
        .join(', ');
    }

    return fromToSql(ctx, data, from, quotedAs);
  }

  let sql = quoteSchemaAndTable(data.schema, (table as Query).table as string);

  if (data.as && quotedAs && quotedAs !== sql) {
    sql += ` ${quotedAs}`;
  }

  if (data.only) sql = `ONLY ${sql}`;

  return sql;
};

const fromToSql = (
  ctx: ToSQLCtx,
  data: QueryData,
  from: QueryDataFromItem,
  quotedAs?: string,
) => {
  let only: boolean | undefined;
  let sql;
  if (typeof from === 'object') {
    if (isExpression(from)) {
      sql = from.toSQL(ctx, quotedAs) + ' ' + quotedAs;
    } else {
      only = from.q.only;

      if (!from.table) {
        sql = `(${moveMutativeQueryToCte(ctx, from)})`;
      }
      // if the query contains more than just schema return (SELECT ...)
      else if (!checkIfASimpleQuery(from)) {
        sql = `(${moveMutativeQueryToCte(ctx, from)}) ${
          quotedAs || `"${getQueryAs(from)}"`
        }`;
      } else {
        sql = quoteSchemaAndTable(from.q.schema, from.table);
      }

      fromQuery = from;
    }
  } else {
    sql = quoteSchemaAndTable(data.schema, from);
  }

  return (only === undefined ? data.only : only) ? `ONLY ${sql}` : sql;
};

export const getSearchLang = (
  ctx: ToSQLCtx,
  data: QueryData,
  source: QuerySourceItem,
  quotedAs?: string,
): string => {
  return (source.langSQL ??=
    'languageColumn' in source
      ? columnToSql(ctx, data, data.shape, source.languageColumn, quotedAs)
      : isRawSQL(source.language)
      ? source.language.toSQL(ctx)
      : addValue(ctx.values, source.language || data.language || 'english'));
};

export const getSearchText = (
  ctx: ToSQLCtx,
  data: QueryData,
  source: QuerySourceItem,
  quotedAs?: string,
  forHeadline?: boolean,
): MaybeArray<string> => {
  let sql = source.textSQL;
  if (sql) return sql;

  if ('in' in source) {
    if (typeof source.in === 'string') {
      sql = columnToSql(ctx, data, data.shape, source.in, quotedAs);
    } else if (Array.isArray(source.in)) {
      sql = `concat_ws(' ', ${source.in
        .map((column) => columnToSql(ctx, data, data.shape, column, quotedAs))
        .join(', ')})`;
    } else {
      sql = [];
      for (const key in source.in) {
        sql.push(columnToSql(ctx, data, data.shape, key, quotedAs));
      }
    }
  } else if ('vector' in source) {
    if (forHeadline) {
      throw new Error(
        'Cannot use a search based on a vector column for a search headline',
      );
    }

    sql = columnToSql(ctx, data, data.shape, source.vector, quotedAs);
  } else {
    if (typeof source.text === 'string') {
      sql = addValue(ctx.values, source.text);
    } else {
      sql = source.text.toSQL(ctx, quotedAs);
    }
  }

  return (source.textSQL = sql);
};

const getTsVector = (
  ctx: ToSQLCtx,
  data: QueryData,
  lang: string,
  source: QuerySourceItem,
  quotedAs?: string,
): string => {
  const text = getSearchText(ctx, data, source, quotedAs);

  if ('in' in source) {
    if (typeof source.in === 'string' || Array.isArray(source.in)) {
      return `to_tsvector(${lang}, ${text})`;
    } else {
      let tsVector = '';
      let i = 0;
      for (const key in source.in) {
        tsVector =
          (tsVector ? `${tsVector} || ` : '') +
          `setweight(to_tsvector(${lang}, ${text[i++]}), ${addValue(
            ctx.values,
            source.in[key],
          )})`;
      }
      return tsVector;
    }
  } else if ('vector' in source) {
    return text as string;
  } else {
    return `to_tsvector(${lang}, ${text})`;
  }
};
