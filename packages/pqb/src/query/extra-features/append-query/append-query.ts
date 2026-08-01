import { prepareSubQueryForSql } from '../../internal-features/sub-query/sub-query-for-sql';
import { pushQueryValueImmutable } from '../../query-data';
import { Query } from '../../query';
import { _prependWith } from '../../basic-features/cte/cte.query';

export const _appendQuery = (
  main: Query,
  append: Query,
  asFn: (as: string) => void,
) => {
  return pushQueryValueImmutable(
    pushQueryValueImmutable(
      main,
      'appendQueries',
      prepareSubQueryForSql(main, append),
    ),
    'asFns',
    asFn,
  );
};

export const _appendQueryOnUpsertCreate = (
  main: Query,
  append: Query,
  asFn: (as: string) => void,
) => {
  return pushQueryValueImmutable(
    pushQueryValueImmutable(
      main,
      'upsertCreateAppendQueries',
      prepareSubQueryForSql(main, append),
    ),
    'upsertCreateAsFns',
    asFn,
  );
};

export const _onUpsertUpdate = (q: Query, asFn: (as: string) => void) => {
  return pushQueryValueImmutable(q, 'upsertUpdateAsFns', asFn);
};

export const _prependWithOnUpsertCreate = (
  q: Query,
  name: string | ((as: string) => void),
  query: Query,
) => {
  const prev = q.q.with;
  q.q.with = q.q.upsertCreateWith;
  _prependWith(q, name, query);
  q.q.upsertCreateWith = q.q.with;
  q.q.with = prev;
};
