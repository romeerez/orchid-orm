import { JSONTypeAny } from './typeBase';

export type JSONNullable<T extends JSONTypeAny> = Omit<T, 'type' | 'data'> & {
  type: T['type'] | null;
  data: T['data'] & { nullable: true };
};

export const nullable = <T extends JSONTypeAny>(type: T): JSONNullable<T> => {
  return {
    ...type,
    data: { ...type.data, nullable: true },
  };
};

export type JSONNotNullable<T extends JSONTypeAny> = Omit<
  T,
  'type' | 'data'
> & {
  type: Exclude<T['type'], null>;
  data: Omit<T['data'], 'nullable'>;
};

export const notNullable = <T extends JSONTypeAny>(
  type: T,
): JSONNotNullable<T> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nullable: _, ...data } = type.data;

  return {
    ...type,
    data,
  } as JSONNotNullable<T>;
};
