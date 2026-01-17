import { prepareSubQueryForSql, pushQueryValueImmutable, Query } from 'pqb';

export const _appendQuery = (main: Query, append: Query) => {
  return pushQueryValueImmutable(
    main,
    'appendQueries',
    prepareSubQueryForSql(main, append),
  );
};
