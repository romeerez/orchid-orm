import { markRelationConditions, RelationJoinQuery } from 'pqb/internal';
import { Query } from 'pqb';

/**
 * Wraps a join function of a relation to mark the conditions it adds to the joining query as relation conditions.
 */
export const markJoinRelationConditions =
  (join: RelationJoinQuery): RelationJoinQuery =>
  (joiningQuery, baseQuery) => {
    const prevAnd = (joiningQuery as Query).q.and;
    const q = join(joiningQuery, baseQuery) as Query;
    markRelationConditions(q, prevAnd);
    return q;
  };
