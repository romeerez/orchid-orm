import { RawSql } from '../../expressions/raw-sql';
import { QueryData } from '../../query-data';

/**
 * Condition of an empty `whereIn` or `orWhereIn` list: an empty `IN` list matches no records.
 */
export const emptyInCondition = new RawSql('false');

/**
 * Condition of an empty `whereNotIn` or `orWhereNotIn` list: an empty `NOT IN` list matches all records.
 * It renders no SQL, and when its `and` or `or` group has no other conditions, the whole user condition is left out of SQL,
 * so it doesn't permit `update` or `delete`.
 */
export const emptyNotInCondition = new RawSql('true');

/**
 * Whether an empty `whereIn` list leaves no records for the query to match,
 * so the query can resolve without querying the database.
 */
export const isWhereEmptyIn = ({ and, or }: QueryData) =>
  !!and?.includes(emptyInCondition) &&
  (!or || or.every((group) => group.includes(emptyInCondition)));
