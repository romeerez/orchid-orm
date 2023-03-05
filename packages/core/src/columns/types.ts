import { ColumnTypesBase } from './columnType';

export type nameKey = typeof nameKey;
export const nameKey: unique symbol = Symbol('name');

export type snakeCaseKey = typeof snakeCaseKey;
export const snakeCaseKey: unique symbol = Symbol('snakeCase');

export function name<T extends ColumnTypesBase>(this: T, name: string): T {
  const types = Object.create(this);
  types[nameKey] = name;
  return types;
}
