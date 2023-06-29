import { addValue, columnToSql, quoteSchemaAndTable } from './common';
import { checkIfASimpleQuery, QuerySourceItem } from './types';
import { makeSql, ToSqlCtx } from './toSql';
import { QueryData, SelectQueryData } from './data';
import { QueryBase } from '../queryBase';
import { isExpression, isRawSQL, MaybeArray } from 'orchid-core';

export const pushFromAndAs = (
  ctx: ToSqlCtx,
  table: QueryBase,
  data: SelectQueryData,
  quotedAs?: string,
) => {
  let sql = 'FROM ';
  if (data.fromOnly) sql += 'ONLY ';

  const from = getFrom(ctx, table, data, quotedAs);
  sql += from;

  if (data.as && quotedAs && quotedAs !== from) {
    sql += ` AS ${quotedAs}`;
  }

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
};

const getFrom = (
  ctx: ToSqlCtx,
  table: QueryBase,
  query: SelectQueryData,
  quotedAs?: string,
) => {
  if (query.from) {
    const { from } = query;
    if (typeof from === 'object') {
      if (isExpression(from)) {
        return from.toSQL(ctx, quotedAs);
      }

      if (!from.table) {
        const sql = makeSql(from, ctx);
        return `(${sql.text})`;
      }

      // if query contains more than just schema return (SELECT ...)
      if (!checkIfASimpleQuery(from)) {
        const sql = makeSql(from, ctx);
        return `(${sql.text})`;
      }

      return quoteSchemaAndTable(from.q.schema, from.table);
    }

    return quoteSchemaAndTable(query.schema, from);
  }

  return quoteSchemaAndTable(query.schema, table.table as string);
};

export const getSearchLang = (
  ctx: ToSqlCtx,
  data: QueryData,
  source: QuerySourceItem,
  quotedAs?: string,
): string => {
  return (source.langSQL ??=
    'languageColumn' in source
      ? columnToSql(data, data.shape, source.languageColumn, quotedAs)
      : isRawSQL(source.language)
      ? source.language.toSQL(ctx)
      : addValue(ctx.values, source.language || data.language || 'english'));
};

export const getSearchText = (
  ctx: ToSqlCtx,
  data: QueryData,
  source: QuerySourceItem,
  quotedAs?: string,
  forHeadline?: boolean,
): MaybeArray<string> => {
  let sql = source.textSQL;
  if (sql) return sql;

  if ('in' in source) {
    if (typeof source.in === 'string') {
      sql = columnToSql(data, data.shape, source.in, quotedAs);
    } else if (Array.isArray(source.in)) {
      sql = `concat_ws(' ', ${source.in
        .map((column) => columnToSql(data, data.shape, column, quotedAs))
        .join(', ')})`;
    } else {
      sql = [];
      for (const key in source.in) {
        sql.push(columnToSql(data, data.shape, key, quotedAs));
      }
    }
  } else if ('vector' in source) {
    if (forHeadline) {
      throw new Error(
        'Cannot use a search based on a vector column for a search headline',
      );
    }

    sql = columnToSql(data, data.shape, source.vector, quotedAs);
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
  ctx: ToSqlCtx,
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
