export const cloneInstance = <T>(instance: T): T => {
  return Object.assign(
    Object.create(Object.getPrototypeOf(instance)),
    instance,
  );
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
        )[name].apply(cloned, args);
      },
    });
  }
};
