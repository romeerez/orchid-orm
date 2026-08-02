import { SelectableOrExpressionOfType, SetQueryReturnsColumnOrThrow } from '../../query';
import { Column } from '../../../columns';
import { PickQuerySelectable, PickQueryTsQuery } from '../../pick-query-types';
import { Expression } from '../../expressions/expression';
import { MaybeArray } from '../../../utils';
import { OrderTsQueryConfig, SearchWeight } from './search.sql';
import { Order } from '../../basic-features/order/order';
type HeadlineSearchArg<T extends PickQueryTsQuery> = Exclude<T['__tsQuery'], undefined>;
interface HeadlineParams<T extends PickQuerySelectable> {
    text?: SelectableOrExpressionOfType<T, Column.Pick.QueryColumnOfType<string>>;
    options?: string | Expression;
}
export interface SearchAggregateMethods {
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
    headline<T extends Order.ArgThis>(this: T, search: HeadlineSearchArg<T>, options?: HeadlineParams<T>): SetQueryReturnsColumnOrThrow<T, Column.Pick.QueryColumnOfType<string>>;
}
export type SearchArg<T extends PickQuerySelectable, As extends string> = {
    as?: As;
    order?: OrderTsQueryConfig;
} & ({
    language?: string | Expression;
} | {
    languageColumn?: keyof T['__selectable'];
}) & ({
    text: string | Expression;
} | {
    in: MaybeArray<keyof T['__selectable']> | {
        [K in keyof T['__selectable']]?: SearchWeight;
    };
} | {
    vector: {
        [K in keyof T['__selectable']]: T['__selectable'][K]['column']['dataType'] extends 'tsvector' ? K : never;
    }[keyof T['__selectable']];
}) & ({
    query: string | Expression;
} | {
    plainQuery: string | Expression;
} | {
    phraseQuery: string | Expression;
} | {
    tsQuery: string | Expression;
});
export type WhereSearchResult<T, As extends string> = T & {
    __tsQuery: string extends As ? never : As;
};
export declare class SearchMethods {
    /**
     * ## language
     *
     * By default, the search language is English.
     *
     * You can set a different default language in the `createTableFactory` config:
     *
     * ```ts
     * import { createTableFactory } from 'orchid-orm';
     *
     * export const { defineTable, defineView, sql } = createTableFactory({
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
    search<T extends PickQuerySelectable, As extends string>(this: T, arg: SearchArg<T, As>): WhereSearchResult<T, As>;
}
export {};
