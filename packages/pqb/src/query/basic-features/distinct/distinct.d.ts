import { SelectableOrExpressions } from '../../expressions/expression';
import { PickQuerySelectable } from '../../pick-query-types';
export declare class QueryDistinct {
    /**
     * Adds a `DISTINCT` keyword to `SELECT`:
     *
     * ```ts
     * db.table.distinct().select('name');
     * ```
     *
     * Can accept column names or raw SQL expressions to place it to `DISTINCT ON (...)`:
     *
     * ```ts
     * import { sql } from './baseTable';
     *
     * // Distinct on the name and raw SQL
     * db.table.distinct('name', sql`raw sql`).select('id', 'name');
     * ```
     *
     * @param columns - column names or a raw SQL
     */
    distinct<T extends PickQuerySelectable>(this: T, ...columns: SelectableOrExpressions<T>): T;
}
