import { PickQueryQ } from '../../pick-query-types';
import { WhereItem } from './where.sql';

/**
 * Condition that a relation adds to a query.
 * It is joined by `AND` with the whole condition of the query, so `orWhere` can't bypass it, and `clear('where')` keeps it.
 */
export class RelationCondition {
  constructor(readonly condition: WhereItem) {}
}

/**
 * Wraps conditions of the query that aren't in `prevAnd` into {@link RelationCondition}.
 * Conditions of `prevAnd` must remain in the query as the same objects.
 */
export const markRelationConditions = (
  q: PickQueryQ,
  prevAnd?: WhereItem[],
) => {
  const { and } = q.q;
  if (!and) return;

  q.q.and = and.map((item) =>
    isRelationCondition(item) || prevAnd?.includes(item)
      ? item
      : new RelationCondition(item),
  );
};

/**
 * Whether the condition is added by a relation, see {@link markRelationConditions}.
 */
export const isRelationCondition = (item: unknown): item is RelationCondition =>
  item instanceof RelationCondition;
