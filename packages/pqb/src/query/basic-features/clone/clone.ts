import { Query } from '../../query';
import { PickQueryQ } from '../../pick-query-types';
import { getClonedQueryData } from '../../query-data';

/**
 * Call `.clone()` on a supposed query object
 */
export const _clone = (q: unknown): Query => (q as unknown as Query).clone();

export class QueryClone {
  /**
   * Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.
   *
   * Used under the hood, and not really needed on the app side.
   */
  clone<T>(this: T): T {
    const cloned = Object.create((this as unknown as Query).baseQuery);
    cloned.q = getClonedQueryData((this as unknown as PickQueryQ).q);
    return cloned;
  }
}
