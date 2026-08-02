import { Query } from '../../query';
/**
 * Methods added to the query prototype when calling {@link QueryMethods.none}.
 */
export declare const noneMethods: {
    then(this: Query, resolve?: (data?: unknown) => void, reject?: (err: unknown) => void): Promise<void | undefined>;
    catch(this: PromiseLike<unknown>, reject?: (err: unknown) => void): PromiseLike<unknown>;
};
export declare const _queryNone: <T>(q: T) => T;
export declare const isQueryNone: (q: unknown) => boolean;
