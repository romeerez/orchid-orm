import { ColumnType } from './base';

export type EmptyObject = Record<never, never>;

export const cloneInstance = <T>(instance: T): T => {
  return Object.assign(
    Object.create(Object.getPrototypeOf(instance)),
    instance,
  );
};

export const addColumnData = <T extends ColumnType, Update extends EmptyObject>(
  self: T,
  data: Update,
) => {
  const cloned = cloneInstance(self);
  cloned.data = { ...self.data, data };
  return cloned as T & { data: T['data'] & Update };
};

export const assignMethodsToClass = <Methods extends Record<string, unknown>>(
  klass: { prototype: unknown },
  methods: Methods,
) => {
  for (const name in methods) {
    Object.defineProperty(klass.prototype, name, {
      configurable: true,
      enumerable: false,
      writable: true,
      value(...args: unknown[]) {
        const cloned = cloneInstance(this);
        return (
          methods as unknown as Record<string, (...args: unknown[]) => unknown>
        )[name].call(cloned, args);
      },
    });
  }
};
