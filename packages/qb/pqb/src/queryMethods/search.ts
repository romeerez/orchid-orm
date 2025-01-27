import {
  Query,
  SelectableOrExpressionOfType,
  SetQueryReturnsColumnOrThrow,
} from '../query/query';
import { AggregateMethods } from './aggregate';
import {
  addValue,
  emptyObject,
  Expression,
  MaybeArray,
  PickQueryMeta,
  QueryColumn,
} from 'orchid-core';
import {
  OrderTsQueryConfig,
  QueryData,
  QuerySourceItem,
  SearchWeight,
  ToSQLCtx,
} from '../sql';
import {
  _clone,
  pushQueryValueImmutable,
  saveSearchAlias,
  setQueryObjectValueImmutable,
} from '../query/queryUtils';
import { getSearchLang, getSearchText } from '../sql/fromAndAs';
import { OrchidOrmInternalError } from '../errors';
import { columnToSql } from '../sql/common';
import { Operators } from '../columns/operators';

// `headline` first argument is a name of the search.
type HeadlineSearchArg<T extends PickQueryMeta> = Exclude<
  T['meta']['tsQuery'],
  undefined
>;

// Options of the `headline` function:
// - text: column name or a raw SQL with the full text to select headline from.
// - options: string or an expression returning Postgres headline options (https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-HEADLINE).
interface HeadlineParams<T extends PickQueryMeta> {
  text?: SelectableOrExpressionOfType<T, QueryColumn<string>>;
  options?: string | Expression;
}

// define a `headline` method on a query builder
declare module './aggregate' {
  interface AggregateMethods {
    /**
     * Give the `as` alias for the search, and it becomes possible to select a text with highlights of the matching words or phrases:
     *
     * ```ts
     * db.table
     *   .search({
     *     as: 'search',
     *     in: 'body',
     *     query: 'query',
     *   })
     *   .select({
     *     highlightedText: (q) => q.headline('search'),
     *   });
     * ```
     *
     * When searching in the generated `tsvector` column, need to provide a text source to the `headline`:
     *
     * ```ts
     * db.table
     *   .search({
     *     as: 'search',
     *     vector: 'textVector',
     *     query: 'query',
     *   })
     *   .select({
     *     // `body` is a column name
     *     highlightedText: (q) => q.headline('search', { text: 'body' }),
     *   });
     * ```
     *
     * `text` can be a raw SQL, here we are joining multiple columns:
     *
     * ```ts
     * import { raw } from 'orchid-orm';
     *
     * db.table
     *   .search({
     *     as: 'search',
     *     vector: 'titleAndBodyVector',
     *     query: 'query',
     *   })
     *   .select({
     *     highlightedText: (q) =>
     *       q.headline('search', { text: raw`concat_ws(' ', title, body)` }),
     *   });
     * ```
     *
     * `headline` supports a string for `options`, see details [in Postgres doc](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-HEADLINE).
     *
     * Provide a simple string or a raw SQL:
     *
     * ```ts
     * db.table
     *   .search({
     *     as: 'search',
     *     in: 'body',
     *     query: 'query',
     *   })
     *   .select({
     *     highlightedText: (q) =>
     *       q.headline('search', {
     *         options:
     *           'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<, StopSel=>>',
     *       }),
     *   });
     * ```
     *
     * @param search - name of the search to use the query from
     * @param options - `text` for a text source, `options` for `ts_headline` options
     */
    headline<T extends PickQueryMeta>(
      this: T,
      search: HeadlineSearchArg<T>,
      options?: HeadlineParams<T>,
    ): SetQueryReturnsColumnOrThrow<T, QueryColumn<string>>;
  }
}

// type of `search` argument
export type SearchArg<T extends PickQueryMeta, As extends string> = {
  // alias this search to use in `order` and/or in `headline`
  as?: As;
  // order results by search rank
  order?: OrderTsQueryConfig;
} & (
  | {
      // language to use for parsing documents into ts_vector
      language?: string | Expression;
    }
  | {
      // use a language stored in a column of the table
      languageColumn?: keyof T['meta']['selectable'];
    }
) &
  (
    | {
        // text to search in: simple string or raw SQL
        text: string | Expression;
      }
    | {
        // Provide one or multiple columns to search in.
        // Define an object like `{ title: 'A', body: 'B' }` to set column weights.
        in:
          | MaybeArray<keyof T['meta']['selectable']>
          | { [K in keyof T['meta']['selectable']]?: SearchWeight };
      }
    | {
        // search in a generated vector column
        vector: {
          [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['dataType'] extends 'tsvector'
            ? K
            : never;
        }[keyof T['meta']['selectable']];
      }
  ) &
  (
    | {
        // string or a raw SQL for `websearch_to_tsquery` kind of query
        query: string | Expression;
      }
    | {
        // string or a raw SQL for `plainto_tsquery` kind of query
        plainQuery: string | Expression;
      }
    | {
        // string or a raw SQL for `phraseto_tsquery` kind of query
        phraseQuery: string | Expression;
      }
    | {
        // string or a raw SQL for `to_tsquery` kind of query
        tsQuery: string | Expression;
      }
  );

// query type after `search`: this is collecting search aliases in `meta.tsQuery`
export type WhereSearchResult<T, As extends string> = T & {
  meta: { tsQuery: string extends As ? never : As };
};

class Headline extends Expression<QueryColumn<string>> {
  result = emptyObject as { value: QueryColumn<string> };

  constructor(
    public q: QueryData,
    public source: QuerySourceItem,
    public params?: HeadlineParams<Query>,
  ) {
    super();
    q.expr = this;
  }

  makeSQL(ctx: ToSQLCtx, quotedAs: string | undefined): string {
    const { q, source, params } = this;
    const lang = getSearchLang(ctx, q, source, quotedAs);

    const text = params?.text
      ? params.text instanceof Expression
        ? params.text.toSQL(ctx, quotedAs)
        : columnToSql(ctx, q, q.shape, params.text, quotedAs)
      : getSearchText(ctx, q, source, quotedAs, true);

    const options = params?.options
      ? `, ${
          params.options instanceof Expression
            ? params.options.toSQL(ctx, quotedAs)
            : addValue(ctx.values, params.options)
        }`
      : '';

    return `ts_headline(${lang}, ${text}, "${source.as}"${options})`;
  }
}

Object.assign(Headline, Operators.text);

AggregateMethods.prototype.headline = function (
  this: PickQueryMeta,
  search,
  params,
) {
  const q = this as unknown as Query;
  const source = q.q.sources?.[search];
  if (!source)
    throw new OrchidOrmInternalError(q, `Search \`${search}\` is not defined`);

  return new Headline(
    q.q,
    source,
    params as HeadlineParams<Query> | undefined,
  ) as never;
};

export class SearchMethods {
  /**
   * ## language
   *
   * By default, the search language is English.
   *
   * You can set a different default language in the `createBaseTable` config:
   *
   * ```ts
   * import { createBaseTable } from 'orchid-orm';
   *
   * export const BaseTable = createBaseTable({
   *   language: 'swedish',
   * });
   * ```
   *
   * See the list of supported language configs with the SQL:
   *
   * ```sql
   * SELECT cfgname FROM pg_ts_config;
   * ```
   *
   * When performing a search, you can override the default language:
   *
   * ```ts
   * db.table.search({
   *   language: 'finnish',
   *   in: 'body',
   *   query: 'query',
   * });
   * ```
   *
   * `language` also accepts a raw SQL.
   *
   * The language can be stored in the column of this table, then you can use `languageColumn` to use this column for the search:
   *
   * ```ts
   * db.table.search({
   *   // the table has `lang` column, use it for the search
   *   languageColumn: 'lang',
   *   in: 'body',
   *   query: 'query',
   * });
   * ```
   *
   * ## text vector to search in
   *
   * The text to search in can be a simple string, or a raw SQL, or a text column, or multiple columns:
   *
   * ```ts
   * db.table.search({
   *   // search in the given string
   *   text: 'simply a string to search in',
   *   query: 'query',
   * });
   *
   * import { raw } from 'orchid-orm';
   *
   * db.table.search({
   *   // raw SQL: join text columns with space
   *   text: raw`concat_ws(' ', title, body)`,
   *   query: 'query',
   * });
   *
   * db.table.search({
   *   // search in a single text column
   *   in: 'body',
   *   query: 'query',
   * });
   *
   * db.table.search({
   *   // search in multiple columns, they are concatenated with `concat_ws` as shown above
   *   in: ['title', 'body'],
   *   query: 'query',
   * });
   *
   * db.table.search({
   *   // search in multiple columns with different weights. Weight can be A, B, C, or D
   *   in: {
   *     title: 'A',
   *     body: 'B',
   *   },
   *   query: 'query',
   * });
   * ```
   *
   * For better performance, define a [generated](/guide/migration-column-methods.html#generated) column of `tsvector` type, and use it in the search with `vector` keyword:
   *
   * ```ts
   * db.table.search({
   *   vector: 'titleAndBodyVector',
   *   query: 'query',
   * });
   * ```
   *
   * ## search query
   *
   * Read about different search queries in [this Postgres doc](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES).
   *
   * `search` method can accept one of the following queries:
   *
   * - `query`: corresponds to `websearch_to_tsquery` in Postgres, good to use by default
   * - `plainQuery`: corresponds to `plainto_tsquery`
   * - `phraseQuery`: corresponds to `phraseto_tsquery`
   * - `tsQuery`: corresponds to `to_tsquery`
   *
   * The `query` (`websearch_to_tsquery`) can work with any user input, while other query kinds require a specific format and will fail for invalid input.
   *
   * Each query kind accepts a string or a raw SQL.
   *
   * ```ts
   * import { raw } from 'orchid-orm';
   *
   * db.table.search({
   *   vector: 'titleAndBodyVector',
   *   // can accept raw SQL:
   *   phraseQuery: raw`'The Fat Rats'`,
   * });
   * ```
   *
   * ## order by search rank
   *
   * Read about search ranking in [this Postgres doc](https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-RANKING).
   *
   * Set `order: true` to order results by the search rank:
   *
   * ```ts
   * db.table.search({
   *   in: 'body',
   *   query: 'query',
   *   // will add ORDER BY ts_rank(to_tsvector('english', body)) DESC
   *   order: true,
   * });
   * ```
   *
   * To order with `ts_rank_cd` instead of `ts_rank`, set `coverDensity: true`:
   *
   * ```ts
   * db.table.search({
   *   in: 'body',
   *   query: 'query',
   *   // will add ORDER BY ts_rank_cd(to_tsvector('english', body)) DESC
   *   order: {
   *     coverDensity: true,
   *   },
   * });
   * ```
   *
   * Other options are:
   *
   * ```ts
   * db.table.search({
   *   in: 'body',
   *   query: 'query',
   *   order: {
   *     // weights for D, C, B, A:
   *     weights: [0.1, 0.2, 0.4, 1],
   *     // by default, rank ignores the document length
   *     // change rank behavior by providing here a special number
   *     normalization: 32,
   *     // it's possible to change the order direction:
   *     dir: 'ASC', // DESC by default
   *   },
   * });
   * ```
   *
   * Giving the `as` alias for the search allows to set the ordering in the `order` method:
   *
   * ```ts
   * db.table
   *   .search({
   *     as: 'search',
   *     in: 'body',
   *     query: 'query',
   *   })
   *   .order({
   *     // can be `search: true` for defaults
   *     search: {
   *       // same options as above
   *       coverDensity: true,
   *       weights: [0.1, 0.2, 0.4, 1.0],
   *       normalization: 32,
   *       dir: 'ASC',
   *     },
   *   });
   * ```
   *
   * @param arg - search config
   */
  search<T extends PickQueryMeta, As extends string>(
    this: T,
    arg: SearchArg<T, As>,
  ): WhereSearchResult<T, As> {
    const q = _clone(this);

    if (!arg.as) {
      const as = saveSearchAlias(q, '@q', 'joinedShapes') as As;

      arg = {
        ...arg,
        as,
      };
    }

    setQueryObjectValueImmutable(q, 'sources', arg.as as string, arg);
    if (arg.order) {
      pushQueryValueImmutable(q, 'order', arg.as);
    }

    return pushQueryValueImmutable(q, 'and', { SEARCH: arg }) as never;
  }
}
