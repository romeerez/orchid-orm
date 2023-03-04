import { JSONTypeAny } from './typeBase';

export type JSONOptional<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: T['type'] | undefined;
  data: T['data'] & { optional: true };
};

export const optional = <T extends JSONTypeAny>(type: T): JSONOptional<T> => {
  return {
    ...type,
    data: { ...type.data, optional: true },
  };
};

export type JSONRequired<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: Exclude<T['type'], undefined>;
  data: Omit<T['data'], 'optional'>;
};

export const required = <T extends JSONTypeAny>(type: T): JSONRequired<T> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { optional: _, ...data } = type.data;

  return {
    ...type,
    data,
  } as JSONRequired<T>;
};
