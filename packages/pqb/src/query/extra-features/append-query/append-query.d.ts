import { Query } from '../../query';
export declare const _appendQuery: (main: Query, append: Query, asFn: (as: string) => void) => Query;
export declare const _appendQueryOnUpsertCreate: (main: Query, append: Query, asFn: (as: string) => void) => Query;
export declare const _onUpsertUpdate: (q: Query, asFn: (as: string) => void) => Query;
export declare const _prependWithOnUpsertCreate: (q: Query, name: string | ((as: string) => void), query: Query) => void;
