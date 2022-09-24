import { JSONTypeAny } from './typeBase';

export type JSONNullish<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: T['type'] | undefined | null;
  data: T['data'] & { nullable: true; optional: true };
};

export const nullish = <T extends JSONTypeAny>(type: T): JSONNullish<T> => {
  return {
    ...type,
    data: { ...type.data, nullable: true, optional: true },
  };
};

export type JSONNotNullish<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: Exclude<T['type'], undefined | null>;
  data: Omit<T['data'], 'nullable'>;
};

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
