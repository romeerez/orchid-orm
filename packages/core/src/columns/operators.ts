type Fn<T> = (key: string, value: T, values: unknown[]) => string;

export type Operator<T> = Fn<T> & { type: T };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseOperators = Record<string, Operator<any>>;

export const createOperator = <T>(fn: Fn<T>) => {
  return Object.assign(fn, { type: undefined as unknown as T });
};
