import { Column } from '../../../columns';
import { SelectArg, SelectAsArg, SelectSelf } from './select';
import { PickQueryQAndInternal, PickQuerySelectable } from '../../pick-query-types';
import { Expression, SelectableOrExpression } from '../../expressions/expression';
import { IsQuery, Query, QueryReturnType } from '../../query';
import { SelectAsValue, SelectItem } from './select.sql';
export interface QueryBatchResult {
    data: any;
    parent: any;
    key: PropertyKey;
}
export declare const addParserForSelectItem: <T extends PickQuerySelectable>(query: T, as: string | undefined, key: string, arg: SelectableOrExpression<T> | Query, columnAlias?: string, joinQuery?: boolean) => string | Expression | Query | undefined;
export declare const processSelectArg: <T extends SelectSelf>(q: T, as: string | undefined, arg: SelectArg<T>, columnAs?: string) => SelectItem | undefined | false;
export declare const processSelectAsArg: <T extends SelectSelf>(q: T, selectAs: SelectAsValue, as: string | undefined, key: string, arg: SelectAsArg<T>[string], columnAlias?: string, outerReturnType?: QueryReturnType) => Column | undefined | false;
export declare const setParserForSelectedString: (query: PickQueryQAndInternal, arg: string, as: string | undefined, columnAs?: string, columnAlias?: string) => string | undefined;
export declare const getShapeFromSelect: (q: IsQuery, isSubQuery?: boolean) => Column.QueryColumns;
