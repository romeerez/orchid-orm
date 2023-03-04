import { ColumnTypesBase } from './columnType';

export type nameKey = typeof nameKey;
export const nameKey: unique symbol = Symbol('name');

export function name<T extends ColumnTypesBase>(this: T, name: string): T {
  const types = Object.create(this);
  types[nameKey] = name;
  return types;
}
