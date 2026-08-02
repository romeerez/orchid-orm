import { Query } from '../../query';
/**
 * Call `.clone()` on a supposed query object
 */
export declare const _clone: (q: unknown) => Query;
export declare class QueryClone {
    /**
     * Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.
     *
     * Used under the hood, and not really needed on the app side.
     */
    clone<T>(this: T): T;
}
