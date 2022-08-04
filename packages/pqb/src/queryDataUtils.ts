import { Query } from './query';
import { QueryData } from './sql';

type QueryDataArrays<T extends Query = Query> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof QueryData<T>]: QueryData<T>[K] extends Array<any>
    ? QueryData<T>[K]
    : never;
};

type QueryDataObjects<T extends Query = Query> = {
  [K in keyof QueryData<T>]: QueryData<T>[K] extends Record<string, unknown>
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
  value: unknown,
): T => {
  const q = self.toQuery();
  (q.query as Record<string, unknown>)[key] = value;
  return q;
};

export const pushQueryArray = <T extends Query, K extends keyof QueryData<T>>(
  self: T,
  key: K,
  value: QueryData<T>[K],
): T => {
  const q = self.toQuery();
  if (!q.query[key]) (q.query as Record<string, unknown>)[key] = value;
  else (q.query[key] as unknown[]).push(...(value as unknown[]));
  return q;
};

export const pushQueryValue = <
  T extends { query?: QueryData; toQuery(): { query: QueryData } },
  K extends keyof QueryDataArrays,
>(
  self: T,
  key: K,
  value: QueryDataArrays[K][number],
): T => {
  const q = self.toQuery();
  if (!q.query[key]) (q.query as Record<string, unknown>)[key] = [value];
  else (q.query[key] as unknown[]).push(value);
  return q as unknown as T;
};

export const setQueryObjectValue = <
  T extends { query?: QueryData; toQuery(): { query: QueryData } },
  K extends keyof QueryDataObjects,
>(
  self: T,
  object: K,
  key: string,
  value: QueryDataObjects[K][string],
): T => {
  const q = self.toQuery();
  if (!q.query[object])
    (q.query as Record<string, Record<string, unknown>>)[object] = {
      [key]: value,
    };
  else
    (q.query as Record<string, Record<string, unknown>>)[object][key] = value;
  return q as unknown as T;
};
