export const setDataValue = <
  T extends { data: object },
  Key extends string,
  Value,
>(
  item: T,
  key: Key,
  value: Value,
) => {
  const cloned = Object.create(item);
  cloned.data = { ...item.data, [key]: value };
  return cloned as Omit<T, 'data'> & {
    data: Omit<T['data'], Key> & { [K in Key]: Value };
  };
};

function min<T extends { data: { min?: number } }, Value extends number>(
  this: T,
  value: Value,
) {
  return setDataValue(this, 'min', value);
}

function max<T extends { data: { max?: number } }, Value extends number>(
  this: T,
  value: Value,
) {
  return setDataValue(this, 'max', value);
}

function length<T extends { data: { length?: number } }, Value extends number>(
  this: T,
  value: Value,
) {
  return setDataValue(this, 'length', value);
}

function size<T extends { data: { size?: number } }, Value extends number>(
  this: T,
  value: Value,
) {
  return setDataValue(this, 'size', value);
}

export type NonEmptyBase = { data: { min?: number; isNonEmpty?: true } };
export type NonEmptyResult<T extends NonEmptyBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'min'> & { min: 1; isNonEmpty: true };
};

function nonEmpty<T extends NonEmptyBase>(this: T): NonEmptyResult<T> {
  const cloned = setDataValue(this, 'min', 1);
  cloned.data.isNonEmpty = true;
  return cloned as NonEmptyResult<T>;
}

export type ArrayMethods = typeof arrayMethods;

export const arrayMethods = {
  min,
  max,
  length,
  nonEmpty,
};

export type SetMethods = typeof setMethods;

export const setMethods = {
  min,
  max,
  size,
  nonEmpty,
};

export const stringTypeMethods = () => ({
  ...arrayMethods,

  email<T extends { data: { email?: boolean } }>(this: T) {
    return setDataValue(this, 'email', true);
  },

  url<T extends { data: { url?: boolean } }>(this: T) {
    return setDataValue(this, 'url', true);
  },

  uuid<T extends { data: { uuid?: boolean } }>(this: T) {
    return setDataValue(this, 'uuid', true);
  },

  cuid<T extends { data: { cuid?: boolean } }>(this: T) {
    return setDataValue(this, 'cuid', true);
  },

  regex<T extends { data: { regex?: RegExp } }, Value extends RegExp>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'regex', value);
  },

  startsWith<T extends { data: { startsWith?: string } }, Value extends string>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'startsWith', value);
  },

  endsWith<T extends { data: { endsWith?: string } }, Value extends string>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'endsWith', value);
  },

  trim<T extends { data: { trim?: boolean } }>(this: T) {
    return setDataValue(this, 'trim', true);
  },
});

export const numberTypeMethods = {
  lt<T extends { data: { lt?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'lt', value);
  },

  lte<T extends { data: { lte?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'lte', value);
  },

  max<T extends { data: { lte?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'lte', value);
  },

  gt<T extends { data: { gt?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'gt', value);
  },

  gte<T extends { data: { gte?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'gte', value);
  },

  min<T extends { data: { gte?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'gte', value);
  },

  positive<T extends { data: { gt?: number } }>(this: T) {
    return setDataValue(this, 'gt', 0);
  },

  nonNegative<T extends { data: { gte?: number } }>(this: T) {
    return setDataValue(this, 'gte', 0);
  },

  negative<T extends { data: { lt?: number } }>(this: T) {
    return setDataValue(this, 'lt', 0);
  },

  nonPositive<T extends { data: { lte?: number } }>(this: T) {
    return setDataValue(this, 'lte', 0);
  },

  multipleOf<T extends { data: { multipleOf?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(
      this,
      'multipleOf',
      Array.isArray(value) ? value[0] : value,
    );
  },

  step<T extends { data: { multipleOf?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    return setDataValue(
      this,
      'multipleOf',
      Array.isArray(value) ? value[0] : value,
    );
  },

  int<T extends { data: { int?: boolean } }>(this: T) {
    return setDataValue(this, 'int', true);
  },
};

export const dateTypeMethods = {
  min<T extends { data: { min?: Date } }, Value extends Date>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'min', Array.isArray(value) ? value[0] : value);
  },

  max<T extends { data: { max?: Date } }, Value extends Date>(
    this: T,
    value: Value,
  ) {
    return setDataValue(this, 'max', Array.isArray(value) ? value[0] : value);
  },
};
