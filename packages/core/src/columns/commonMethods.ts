import { BaseStringData } from './columnDataTypes';

export type MessageParam =
  | string
  | {
      message?: string;
    };

export const setDataValue = <
  T extends { data: object },
  Key extends string,
  Value,
>(
  item: T,
  key: Key,
  value: Value,
  params?: MessageParam,
) => {
  const cloned = Object.create(item);
  cloned.data = { ...item.data, [key]: value };

  if (params && (typeof params === 'string' || params.message)) {
    (cloned.data.errors ??= {})[key] =
      typeof params === 'string' ? params : params.message;
  }

  return cloned as Omit<T, 'data'> & {
    data: Omit<T['data'], Key> & { [K in Key]: Value };
  };
};

function min<T extends { data: { min?: number } }, Value extends number>(
  this: T,
  value: Value,
  params?: MessageParam,
) {
  return setDataValue(this, 'min', value, params);
}

function max<T extends { data: { max?: number } }, Value extends number>(
  this: T,
  value: Value,
  params?: MessageParam,
) {
  return setDataValue(this, 'max', value, params);
}

function length<T extends { data: { length?: number } }, Value extends number>(
  this: T,
  value: Value,
  params?: MessageParam,
) {
  return setDataValue(this, 'length', value, params);
}

function size<T extends { data: { size?: number } }, Value extends number>(
  this: T,
  value: Value,
  params?: MessageParam,
) {
  return setDataValue(this, 'size', value, params);
}

export type NonEmptyBase = { data: { min?: number; nonEmpty?: boolean } };
export type NonEmptyResult<T extends NonEmptyBase> = Omit<T, 'data'> & {
  data: Omit<T['data'], 'min'> & { min: 1; isNonEmpty: true };
};

function nonEmpty<T extends NonEmptyBase>(
  this: T,
  params?: MessageParam,
): NonEmptyResult<T> {
  const cloned = setDataValue(this, 'min', 1, params);
  cloned.data.nonEmpty = true;
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

  email<T extends { data: { email?: boolean } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'email', true, params);
  },

  url<T extends { data: { url?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'url', true, params);
  },

  emoji<T extends { data: { emoji?: boolean } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'emoji', true, params);
  },

  uuid<T extends { data: { uuid?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'uuid', true, params);
  },

  cuid<T extends { data: { cuid?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'cuid', true, params);
  },

  cuid2<T extends { data: { cuid2?: boolean } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'cuid2', true, params);
  },

  ulid<T extends { data: { ulid?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'ulid', true, params);
  },

  regex<T extends { data: { regex?: RegExp } }, Value extends RegExp>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    if (Array.isArray(value)) {
      throw new Error('wtf');
    }
    return setDataValue(this, 'regex', value, params);
  },

  includes<T extends { data: { includes?: string } }, Value extends string>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'includes', value, params);
  },

  startsWith<T extends { data: { startsWith?: string } }, Value extends string>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'startsWith', value, params);
  },

  endsWith<T extends { data: { endsWith?: string } }, Value extends string>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'endsWith', value, params);
  },

  datetime<T extends { data: { datetime?: BaseStringData['datetime'] } }>(
    this: T,
    params: BaseStringData['datetime'] & Exclude<MessageParam, string> = {},
  ) {
    return setDataValue(this, 'datetime', params, params);
  },

  ip<T extends { data: { ip?: BaseStringData['ip'] } }>(
    this: T,
    params: BaseStringData['ip'] & Exclude<MessageParam, string> = {},
  ) {
    return setDataValue(this, 'ip', params, params);
  },

  trim<T extends { data: { trim?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'trim', true, params);
  },

  toLowerCase<T extends { data: { toLowerCase?: boolean } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'toLowerCase', true, params);
  },

  toUpperCase<T extends { data: { toUpperCase?: boolean } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'toUpperCase', true, params);
  },
});

export const numberTypeMethods = {
  lt<T extends { data: { lt?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'lt', value, params);
  },

  lte<T extends { data: { lte?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'lte', value, params);
  },

  max<T extends { data: { lte?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'lte', value, params);
  },

  gt<T extends { data: { gt?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'gt', value, params);
  },

  gte<T extends { data: { gte?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'gte', value, params);
  },

  min<T extends { data: { gte?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'gte', value, params);
  },

  positive<T extends { data: { gt?: number } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'gt', 0, params);
  },

  nonNegative<T extends { data: { gte?: number } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'gte', 0, params);
  },

  negative<T extends { data: { lt?: number } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'lt', 0, params);
  },

  nonPositive<T extends { data: { lte?: number } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'lte', 0, params);
  },

  multipleOf<T extends { data: { step?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(
      this,
      'step',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },

  step<T extends { data: { step?: number } }, Value extends number>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(
      this,
      'step',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },

  int<T extends { data: { int?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'int', true, params);
  },

  finite<T extends { data: { finite?: boolean } }>(
    this: T,
    params?: MessageParam,
  ) {
    return setDataValue(this, 'finite', true, params);
  },

  safe<T extends { data: { safe?: boolean } }>(this: T, params?: MessageParam) {
    return setDataValue(this, 'safe', true, params);
  },
};

export type DateTypeMethods = typeof dateTypeMethods;
export const dateTypeMethods = {
  min<T extends { data: { min?: Date } }, Value extends Date>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(
      this,
      'min',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },

  max<T extends { data: { max?: Date } }, Value extends Date>(
    this: T,
    value: Value,
    params?: MessageParam,
  ) {
    return setDataValue(
      this,
      'max',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },
};
