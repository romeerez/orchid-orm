import { QueryGetSelf } from '../get/get.utils';
import { SetQueryReturnsColumnOrThrow } from '../../query';
import { BooleanQueryColumn } from '../aggregate/aggregate';
export declare class QueryExistsMethods {
    /**
     * Use `exists()` to check if there is at least one record-matching condition.
     *
     * It will discard previous `select` statements if any. Returns a boolean.
     *
     * ```ts
     * const exists: boolean = await db.table.where(...conditions).exists();
     * ```
     */
    exists<T extends QueryGetSelf>(this: T): SetQueryReturnsColumnOrThrow<T, BooleanQueryColumn>;
    /**
     * Use `notExists()` to check if there are no matching records.
     *
     * It will discard previous `select` statements if any. Returns a boolean.
     *
     * ```ts
     * const exists: boolean = await db.table.where(...conditions).notExists();
     * ```
     */
    notExists<T extends QueryGetSelf>(this: T): SetQueryReturnsColumnOrThrow<T, BooleanQueryColumn>;
}
