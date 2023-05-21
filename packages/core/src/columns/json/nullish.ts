import { JSONTypeAny } from './typeBase';

// make the JSON type to possibly be a null or undefined
export type JSONNullish<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: T['type'] | undefined | null;
  data: T['data'] & { nullable: true; optional: true };
};

// make the JSON type to possibly be a null or undefined
export const nullish = <T extends JSONTypeAny>(type: T): JSONNullish<T> => {
  return {
    ...type,
    data: { ...type.data, nullable: true, optional: true },
  };
};

// exclude null and undefined from the JSON type
export type JSONNotNullish<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: Exclude<T['type'], undefined | null>;
  data: Omit<T['data'], 'nullable'>;
};

// exclude null and undefined from the JSON type
export const notNullish = <T extends JSONTypeAny>(
  type: T,
): JSONNotNullish<T> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nullable, optional, ...data } = type.data;

  return {
    ...type,
    data,
  } as JSONNotNullish<T>;
};
