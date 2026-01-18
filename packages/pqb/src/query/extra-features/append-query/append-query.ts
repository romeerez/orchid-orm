import { prepareSubQueryForSql, pushQueryValueImmutable, Query } from 'pqb';

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
