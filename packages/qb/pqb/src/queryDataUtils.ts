import { QueryData } from './sql';
import { pushOrNewArrayToObject } from 'orchid-core';
import { OrchidOrmInternalError } from './errors';
import { Query } from './query';

/**
 * Push all elements of given array into the array in the query data,
 * set given array if there is no array yet in the query data.
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - array with values
 */
export const pushQueryArray = <T extends { q: QueryData }>(
  q: T,
  key: string,
  value: unknown,
): T => {
  if (!q.q[key as keyof typeof q.q])
    (q.q as Record<string, unknown>)[key] = value;
  else
    (q.q[key as keyof typeof q.q] as unknown[]).push(...(value as unknown[]));
  return q as T;
};

/**
 * Push new element into array in the query data, create the array if it doesn't yet exist.
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - new element to push
 */
export const pushQueryValue = <T extends { q: QueryData }>(
  q: T,
  key: string,
  value: unknown,
): T => {
  pushOrNewArrayToObject(
    q.q as unknown as Record<string, unknown[]>,
    key,
    value,
  );
  return q;
};

/**
 * Set value into the object in query data, create the object if it doesn't yet exist.
 *
 * @param q - query
 * @param object - query data key  to get the object
 * @param key - object key to set the value into
 * @param value - value to set by the key
 */
export const setQueryObjectValue = <T extends { q: QueryData }>(
  q: T,
  object: string,
  key: string,
  value: unknown,
): T => {
  if (!q.q[object as keyof typeof q.q])
    (q.q as unknown as Record<string, Record<string, unknown>>)[object] = {
      [key]: value,
    };
  else
    (q.q as unknown as Record<string, Record<string, unknown>>)[object][key] =
      value;
  return q as unknown as T;
};

/**
 * Throw runtime error when delete or update has no where conditions
 *
 * @param q - query
 * @param method - 'update' or 'delete'
 */
export const throwIfNoWhere = (q: Query, method: string) => {
  if (!q.q.or && !q.q.and) {
    throw new OrchidOrmInternalError(
      q,
      `Dangerous ${method} without conditions`,
    );
  }
};
