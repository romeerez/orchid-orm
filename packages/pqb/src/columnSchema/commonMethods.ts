import { BaseStringData } from './string';
import { BaseNumberData } from './number';

export type ArrayMethods = typeof arrayMethods;

export const arrayMethods = {
  min<T extends { data: { min?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    this.data.min = value;
    return this as T & { data: Omit<T['data'], 'min'> & { min: Value } };
  },

  max<T extends { data: { max?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    this.data.max = value;
    return this as T & { data: Omit<T['data'], 'max'> & { max: Value } };
  },

  length<T extends { data: { length?: number } }, Value extends number>(
    this: T,
    value: Value,
  ) {
    this.data.length = value;
    return this as T & { data: Omit<T['data'], 'length'> & { length: Value } };
  },
};

export const stringTypeMethods = <Base extends { data: BaseStringData }>() => ({
  ...arrayMethods,

  email<T extends Base>(this: T) {
    this.data.email = true;
    return this as T & { data: Omit<T['data'], 'email'> & { email: true } };
  },

  url<T extends Base>(this: T) {
    this.data.url = true;
    return this as T & { data: Omit<T['data'], 'url'> & { url: true } };
  },

  uuid<T extends Base>(this: T) {
    this.data.uuid = true;
    return this as T & { data: Omit<T['data'], 'uuid'> & { uuid: true } };
  },

  cuid<T extends Base>(this: T) {
    this.data.cuid = true;
    return this as T & { data: Omit<T['data'], 'cuid'> & { cuid: true } };
  },

  regex<T extends Base, Value extends RegExp>(this: T, value: Value) {
    this.data.regex = value;
    return this as T & { data: Omit<T['data'], 'regex'> & { regex: Value } };
  },

  trim<T extends Base>(this: T) {
    this.data.trim = true;
    return this as T & { data: Omit<T['data'], 'trim'> & { trim: true } };
  },
});

export const numberTypeMethods = <Base extends { data: BaseNumberData }>() => ({
  lt<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.lt = value;
    return this as T & { data: Omit<T['data'], 'lt'> & { lt: Value } };
  },

  lte<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.lte = value;
    return this as T & { data: Omit<T['data'], 'lte'> & { lte: Value } };
  },

  max<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.lte = value;
    return this as T & { data: Omit<T['data'], 'lte'> & { lte: Value } };
  },

  gt<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.gt = value;
    return this as T & { data: Omit<T['data'], 'gt'> & { gt: Value } };
  },

  gte<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.gte = value;
    return this as T & { data: Omit<T['data'], 'gte'> & { gte: Value } };
  },

  min<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.gte = value;
    return this as T & { data: Omit<T['data'], 'gte'> & { gte: Value } };
  },

  positive<T extends Base>(this: T) {
    this.data.gt = 0;
    return this as T & { data: Omit<T['data'], 'gt'> & { gt: 0 } };
  },

  nonNegative<T extends Base>(this: T) {
    this.data.gte = 0;
    return this as T & { data: Omit<T['data'], 'gte'> & { gte: 0 } };
  },

  negative<T extends Base>(this: T) {
    this.data.lt = 0;
    return this as T & { data: Omit<T['data'], 'lt'> & { lt: 0 } };
  },

  nonPositive<T extends Base>(this: T) {
    this.data.lte = 0;
    return this as T & { data: Omit<T['data'], 'lte'> & { lte: 0 } };
  },

  multipleOf<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.multipleOf = value;
    return this as T & {
      data: Omit<T['data'], 'multipleOf'> & { multipleOf: Value };
    };
  },

  step<T extends Base, Value extends number>(this: T, value: Value) {
    this.data.multipleOf = value;
    return this as T & {
      data: Omit<T['data'], 'multipleOf'> & { multipleOf: Value };
    };
  },
});
