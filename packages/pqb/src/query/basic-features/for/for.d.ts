import { IsQuery } from '../../query';
import { Expression } from '../../expressions/expression';
type ForQueryBuilder<Q> = Q & {
    noWait<T extends Q>(this: T): T;
    skipLocked<T extends Q>(this: T): T;
};
export declare class For {
    forUpdate<T extends IsQuery>(this: T, tableNames?: string[] | Expression): ForQueryBuilder<T>;
    forNoKeyUpdate<T extends IsQuery>(this: T, tableNames?: string[] | Expression): ForQueryBuilder<T>;
    forShare<T extends IsQuery>(this: T, tableNames?: string[] | Expression): ForQueryBuilder<T>;
    forKeyShare<T extends IsQuery>(this: T, tableNames?: string[] | Expression): ForQueryBuilder<T>;
}
export {};
