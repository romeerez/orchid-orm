import { StringTypeData } from './columnDataTypes';

// Parameter of column types to customize an error message.
export type ErrorMessage =
  | string
  | {
      message?: string;
    };

// Clone a column or a JSON type and set the value in its data.
export const setDataValue = <
  T extends { data: object },
  Key extends string,
  Value,
>(
  item: T,
  key: Key,
  value: Value,
  params?: ErrorMessage,
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

// Data for array column and JSON type
export type ArrayTypeData<Item> = {
  item: Item;
  min?: number;
  max?: number;
  length?: number;
  nonEmpty?: boolean;
};

// To require array or string data in methods
type HasArrayData = { data: Omit<ArrayTypeData<unknown>, 'item'> };

// Validation methods for array column and JSON type
export type ArrayTypeMethods = typeof arrayTypeMethods;
export const arrayTypeMethods = {
  // Require a minimum length (inclusive)
  min<T extends HasArrayData>(this: T, value: number, params?: ErrorMessage) {
    return setDataValue(this, 'min', value, params);
  },
  // Require a maximum length (inclusive)
  max<T extends HasArrayData>(this: T, value: number, params?: ErrorMessage) {
    return setDataValue(this, 'max', value, params);
  },
  // Require a specific length
  length<T extends HasArrayData>(
    this: T,
    value: number,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'length', value, params);
  },
  // Require a value to be non-empty
  nonEmpty<T extends HasArrayData>(this: T, params?: ErrorMessage) {
    const cloned = setDataValue(this, 'min', 1, params);
    cloned.data.nonEmpty = true;
    return cloned;
  },
};

// Validation methods for string column and JSON type
export type StringTypeMethods = typeof stringTypeMethods;
export const stringTypeMethods = {
  ...arrayTypeMethods,

  // Check a value to be a valid email
  email<T extends { data: { email?: boolean } }>(
    this: T,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'email', true, params);
  },

  // Check a value to be a valid url
  url<T extends { data: { url?: boolean } }>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'url', true, params);
  },

  // Check a value to be an emoji
  emoji<T extends { data: { emoji?: boolean } }>(
    this: T,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'emoji', true, params);
  },

  // Check a value to be a valid uuid
  uuid<T extends { data: { uuid?: boolean } }>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'uuid', true, params);
  },

  // Check a value to be a valid cuid
  cuid<T extends { data: { cuid?: boolean } }>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'cuid', true, params);
  },

  // Check a value to be a valid cuid2
  cuid2<T extends { data: { cuid2?: boolean } }>(
    this: T,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'cuid2', true, params);
  },

  // Check a value to be a valid ulid
  ulid<T extends { data: { ulid?: boolean } }>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'ulid', true, params);
  },

  // Validate the value over the given regular expression
  regex<T extends { data: { regex?: RegExp } }>(
    this: T,
    value: RegExp,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'regex', value, params);
  },

  // Check a value to include a given string
  includes<T extends { data: { includes?: string } }, Value extends string>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'includes', value, params);
  },

  // Check a value to start with a given string
  startsWith<T extends { data: { startsWith?: string } }, Value extends string>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'startsWith', value, params);
  },

  // Check a value to end with a given string
  endsWith<T extends { data: { endsWith?: string } }, Value extends string>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'endsWith', value, params);
  },

  // Check a value have a valid datetime string
  datetime<T extends { data: { datetime?: StringTypeData['datetime'] } }>(
    this: T,
    params: StringTypeData['datetime'] & Exclude<ErrorMessage, string> = {},
  ) {
    return setDataValue(this, 'datetime', params, params);
  },

  // Check a value to be a valid ip address
  ip<T extends { data: { ip?: StringTypeData['ip'] } }>(
    this: T,
    params: StringTypeData['ip'] & Exclude<ErrorMessage, string> = {},
  ) {
    return setDataValue(this, 'ip', params, params);
  },

  // Trim the value during a validation
  trim<T extends { data: { trim?: boolean } }>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'trim', true, params);
  },

  // Transform value to a lower case during a validation
  toLowerCase<T extends { data: { toLowerCase?: boolean } }>(
    this: T,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'toLowerCase', true, params);
  },

  // Transform value to an upper case during a validation
  toUpperCase<T extends { data: { toUpperCase?: boolean } }>(
    this: T,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'toUpperCase', true, params);
  },
};

// Data for numeric columns and JSON type
export type NumberTypeData = {
  lt?: number;
  lte?: number;
  gt?: number;
  step?: number;
  int?: boolean;
  finite?: boolean;
  safe?: boolean;
};

// To require number data in methods
type HasNumberData = { data: NumberTypeData };

// Validation methods for numeric columns and JSON type
export type NumberTypeMethods = typeof numberTypeMethods;
export const numberTypeMethods = {
  // Require a value to be lower than a given number
  lt<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'lt', value, params);
  },

  // Require a value to be lower than or equal to a given number (the same as `max`)
  lte<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'lte', value, params);
  },

  // Require a value to be lower than or equal to a given number
  max<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'lte', value, params);
  },

  // Require a value to be greater than a given number
  gt<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'gt', value, params);
  },

  // Require a value to be greater than or equal to a given number (the same as `min`)
  gte<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'gte', value, params);
  },

  // Require a value to be greater than or equal to a given number
  min<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(this, 'gte', value, params);
  },

  // Require a value to be greater than 0
  positive<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'gt', 0, params);
  },

  // Require a value to be greater than or equal to 0
  nonNegative<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'gte', 0, params);
  },

  // Require a value to be lower than 0
  negative<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'lt', 0, params);
  },

  // Require a value to be lower than or equal to 0
  nonPositive<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'lte', 0, params);
  },

  // Require a value to be a multiple of a given number (the same as `step`)
  multipleOf<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(
      this,
      'step',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },

  // Require a value to be a multiple of a given number
  step<T extends HasNumberData, Value extends number>(
    this: T,
    value: Value,
    params?: ErrorMessage,
  ) {
    return setDataValue(
      this,
      'step',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },

  // Require a value to be an integer
  int<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'int', true, params);
  },

  // Exclude `Infinity` from being a valid value
  finite<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'finite', true, params);
  },

  // Require the value to be less than or equal to Number.MAX_SAFE_INTEGER
  safe<T extends HasNumberData>(this: T, params?: ErrorMessage) {
    return setDataValue(this, 'safe', true, params);
  },
};

// Type of validation methods for date and timestamp columns
export type DateTypeMethods = typeof dateTypeMethods;

// Validation methods for date and timestamp columns
export const dateTypeMethods = {
  // Require a value to be greater than or equal to a given Date object
  min<T extends { data: { min?: Date } }>(
    this: T,
    value: Date,
    params?: ErrorMessage,
  ) {
    return setDataValue(
      this,
      'min',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },

  // Require a value to be lower than or equal to a given Date object
  max<T extends { data: { max?: Date } }>(
    this: T,
    value: Date,
    params?: ErrorMessage,
  ) {
    return setDataValue(
      this,
      'max',
      Array.isArray(value) ? value[0] : value,
      params,
    );
  },
};
