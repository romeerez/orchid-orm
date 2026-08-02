import { SortDir } from '../../basic-features/order/order.sql';
import { MaybeArray } from '../../../utils';
import { Expression } from '../../expressions/expression';
import { ToSQLCtx } from '../../sql/to-sql';
import { QueryData } from '../../query-data';
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
} & ({
    language?: string;
} | {
    languageColumn: string;
}) & ({
    text: string | Expression;
} | {
    in: MaybeArray<string> | SearchWeightRecord;
} | {
    vector: string;
}) & ({
    query: string | Expression;
} | {
    plainQuery: string | Expression;
} | {
    phraseQuery: string | Expression;
} | {
    tsQuery: string | Expression;
});
export interface QueryDataSources {
    [K: string]: QuerySourceItem;
}
export declare const searchSourcesToSql: (ctx: ToSQLCtx, data: QueryData, sources: QueryDataSources, sql: string, quotedAs?: string) => string;
export declare const getSearchLang: (ctx: ToSQLCtx, data: QueryData, source: QuerySourceItem, quotedAs?: string) => string;
export declare const getSearchText: (ctx: ToSQLCtx, data: QueryData, source: QuerySourceItem, quotedAs?: string, forHeadline?: boolean) => MaybeArray<string>;
export {};
