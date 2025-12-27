import { columnToSql } from '../../sql/column-to-sql';
import { SortDir } from '../../basic-features/order/order.sql';
import { addValue, MaybeArray } from '../../../utils';
import { Expression } from '../../expressions/expression';
import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
import { isRawSQL } from '../../expressions/raw-sql';

export type OrderTsQueryConfig = true | OrderTsQueryConfigObject;

interface OrderTsQueryConfigObject {
  coverDensity?: boolean;
  weights?: number[];
  normalization?: number;
  dir?: SortDir;
}

export type SearchWeight = 'A' | 'B' | 'C' | 'D';

export interface SearchWeightRecord {
  [K: string]: SearchWeight;
}

export interface WhereSearchItem {
  as: string;
  vectorSQL: string;
}

export type QuerySourceItem = {
  queryAs: string;
  as?: string;
  textSQL?: MaybeArray<string>;
  langSQL?: string;
  vectorSQL?: string;
  order?: OrderTsQueryConfig;
} & (
  | {
      language?: string;
    }
  | {
      languageColumn: string;
    }
) &
  (
    | {
        text: string | Expression;
      }
    | {
        in: MaybeArray<string> | SearchWeightRecord;
      }
    | {
        vector: string;
      }
  ) &
  (
    | {
        query: string | Expression;
      }
    | {
        plainQuery: string | Expression;
      }
    | {
        phraseQuery: string | Expression;
      }
    | {
        tsQuery: string | Expression;
      }
  );

export interface QueryDataSources {
  [K: string]: QuerySourceItem;
}

export const searchSourcesToSql = (
  ctx: ToSQLCtx,
  data: QueryData,
  sources: QueryDataSources,
  sql: string,
  quotedAs?: string,
): string => {
  for (const as in sources) {
    const source = sources[as];

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
  return sql;
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
