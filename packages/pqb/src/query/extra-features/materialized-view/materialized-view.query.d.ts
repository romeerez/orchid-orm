import { Query } from '../../query';
export interface RefreshMaterializedViewOptions {
    /**
     * Refresh the materialized view without blocking concurrent selects.
     */
    concurrently?: boolean;
    /**
     * Use `WITH DATA` or `WITH NO DATA` for the refreshed materialized view.
     */
    withData?: boolean;
}
/**
 * Refresh a materialized view.
 */
export declare const refreshMaterializedView: <T extends Query.MaterializedQuery>(query: T, options?: RefreshMaterializedViewOptions) => Promise<void>;
