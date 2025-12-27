import { QueryData } from '../query-data';
import { PickQueryQ } from '../pick-query-types';

// used in `from` logic to decide if convert query to sql or just write table name
export const checkIfASimpleQuery = (q: PickQueryQ) => {
  if (
    (q.q.returnType && q.q.returnType !== 'all') ||
    q.q.selectAllColumns ||
    q.q.and?.length ||
    q.q.or?.length ||
    q.q.scopes
  )
    return false;

  const keys = Object.keys(q.q) as (keyof QueryData)[];
  return !keys.some((key) => queryKeysOfNotSimpleQuery.includes(key));
};

const queryKeysOfNotSimpleQuery: (keyof QueryData)[] = [
  'with',
  'as',
  'from',
  'select',
  'distinct',
  'only',
  'join',
  'group',
  'having',
  'window',
  'union',
  'order',
  'limit',
  'offset',
  'for',
];
