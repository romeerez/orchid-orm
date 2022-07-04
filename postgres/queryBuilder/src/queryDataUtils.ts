import { Query } from './query';
import { QueryData } from './sql/types';

type QueryDataArrays<T extends Query> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof QueryData<T>]: QueryData<T>[K] extends Array<any>
    ? QueryData<T>[K]
    : never;
};

export const removeFromQuery = <T extends Query>(
  q: { query?: QueryData<T> },
  key: keyof QueryData<T>,
) => {
  if (q.query) delete q.query[key];
};

export const setQueryValue = <T extends Query, K extends keyof QueryData<T>>(
  self: T,
  key: K,
  value: QueryData<T>[K],
): T => {
  const q = self.toQuery();
  q.query[key] = value;
  return q;
};

export const pushQueryArray = <T extends Query, K extends keyof QueryData<T>>(
  self: T,
  key: K,
  value: QueryData<T>[K],
): T => {
  const q = self.toQuery();
  if (!q.query[key]) q.query[key] = value;
  else (q.query[key] as unknown[]).push(...(value as unknown[]));
  return q;
};

export const pushQueryValue = <
  T extends Query,
  K extends keyof QueryDataArrays<T>,
>(
  self: T,
  key: K,
  value: QueryDataArrays<T>[K][number],
): T => {
  const q = self.toQuery();
  if (!q.query[key]) q.query[key] = [value] as QueryData<T>[K];
  else (q.query[key] as unknown[]).push(value);
  return q;
};
