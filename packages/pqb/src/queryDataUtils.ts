import { Query } from './query';
import { QueryData } from './sql';
import { pushOrNewArrayToObject } from './utils';

// TODO: remove
export const removeFromQuery = <T extends Query>(q: T, key: string): T => {
  if (q.query) delete q.query[key as keyof typeof q.query];
  return q;
};

export const pushQueryArray = <T extends { query: QueryData }>(
  q: T,
  key: string,
  value: unknown,
): T => {
  if (!q.query[key as keyof typeof q.query])
    (q.query as Record<string, unknown>)[key] = value;
  else
    (q.query[key as keyof typeof q.query] as unknown[]).push(
      ...(value as unknown[]),
    );
  return q as T;
};

export const pushQueryValue = <T extends { query: QueryData }>(
  q: T,
  key: string,
  value: unknown,
): T => {
  pushOrNewArrayToObject(
    q.query as unknown as Record<string, unknown[]>,
    key,
    value,
  );
  return q;
};

export const setQueryObjectValue = <T extends { query: QueryData }>(
  q: T,
  object: string,
  key: string,
  value: unknown,
): T => {
  if (!q.query[object as keyof typeof q.query])
    (q.query as unknown as Record<string, Record<string, unknown>>)[object] = {
      [key]: value,
    };
  else
    (q.query as unknown as Record<string, Record<string, unknown>>)[object][
      key
    ] = value;
  return q as unknown as T;
};
