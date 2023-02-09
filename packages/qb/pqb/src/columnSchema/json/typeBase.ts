import { JSONOptional, JSONRequired, optional, required } from './optional';
import {
  JSONNotNullable,
  JSONNullable,
  notNullable,
  nullable,
} from './nullable';
import { JSONNotNullish, JSONNullish, notNullish, nullish } from './nullish';
import { intersection, JSONIntersection } from './intersection';
import { array, JSONArray } from './array';
import { ColumnChain, ColumnData, ValidationContext } from '../columnType';
import { addCode, Code, columnChainToCode } from '../code';
import { union } from './union';
import { toArray } from '../../utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JSONTypeAny = JSONType<any>;

export type DeepPartial<T extends JSONTypeAny> = ReturnType<
  JSONTypeAny['deepPartial']
> extends ReturnType<T['deepPartial']>
  ? T
  : ReturnType<T['deepPartial']>;

export type JSONTypeData = ColumnData & {
  optional?: true;
  nullable?: true;
  isDeepPartial?: true;
  isNonEmpty?: true;
};

export type Primitive = string | number | bigint | boolean | null | undefined;

export type JSONType<Type, DataType extends string = string> = {
  type: Type;
  data: JSONTypeData;
  dataType: DataType;
  chain: ColumnChain;

  toCode(t: string): Code;

  optional<T extends JSONTypeAny>(this: T): JSONOptional<T>;
  required<T extends JSONTypeAny>(this: T): JSONRequired<T>;
  nullable<T extends JSONTypeAny>(this: T): JSONNullable<T>;
  notNullable<T extends JSONTypeAny>(this: T): JSONNotNullable<T>;
  nullish<T extends JSONTypeAny>(this: T): JSONNullish<T>;
  notNullish<T extends JSONTypeAny>(this: T): JSONNotNullish<T>;
  deepPartial(): JSONTypeAny;

  transform<T extends JSONTypeAny, Transformed>(
    this: T,
    fn: (input: T['type'], ctx: ValidationContext) => Transformed,
  ): JSONType<
    Transformed extends PromiseLike<unknown>
      ? Awaited<Transformed>
      : Transformed,
    T['dataType']
  >;

  to<T extends JSONTypeAny, ToType extends JSONTypeAny>(
    this: T,
    fn: (input: T['type']) => ToType['type'] | undefined,
    type: ToType,
  ): ToType;

  refine<T extends JSONTypeAny, RefinedOutput extends T['type']>(
    this: T,
    check: (arg: T['type']) => unknown,
  ): T & { type: RefinedOutput };

  superRefine<T extends JSONTypeAny, RefinedOutput extends T['type']>(
    this: T,
    check: (arg: T['type'], ctx: ValidationContext) => unknown,
  ): T & { type: RefinedOutput };

  and<A extends JSONTypeAny, B extends JSONTypeAny>(
    this: A,
    type: B,
  ): JSONIntersection<A, B>;

  or<T extends JSONTypeAny, U extends [JSONTypeAny, ...JSONTypeAny[]]>(
    this: T,
    ...types: U
  ): T | U[number];

  default<T extends JSONTypeAny>(
    this: T,
    value: T['type'] | (() => T['type']),
  ): JSONNotNullish<T>;

  array<T extends JSONTypeAny>(this: T): JSONArray<T>;
};

export const toCode = (type: JSONTypeAny, t: string, code: Code) => {
  code = toArray(code);

  if (type.data.nullable && type.data.optional) {
    addCode(code, '.nullish()');
  } else if (type.data.nullable) {
    addCode(code, '.nullable()');
  } else if (type.data.optional) {
    addCode(code, '.optional()');
  }

  if (type.data.isDeepPartial) {
    addCode(code, '.deepPartial()');
  }

  if (type.data.isNonEmpty) {
    addCode(code, '.nonEmpty()');
  }

  if (type.data.default) {
    addCode(code, `.default(${JSON.stringify(type.data.default)})`);
  }

  return columnChainToCode(type.chain, t, code);
};

const baseTypeMethods: JSONTypeAny = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: undefined as any,
  data: {},
  dataType: 'any',
  chain: [],

  toCode() {
    throw new Error('toCode is not implemented');
  },

  optional<T extends JSONTypeAny>(this: T) {
    return optional(this);
  },

  required<T extends JSONTypeAny>(this: T) {
    return required(this);
  },

  nullable<T extends JSONTypeAny>(this: T) {
    return nullable(this);
  },

  notNullable<T extends JSONTypeAny>(this: T) {
    return notNullable(this);
  },

  nullish<T extends JSONTypeAny>(this: T) {
    return nullish(this);
  },

  notNullish<T extends JSONTypeAny>(this: T) {
    return notNullish(this);
  },

  deepPartial() {
    return this.optional();
  },

  transform<T extends JSONTypeAny, Transformed>(
    this: T,
    fn: (input: unknown, ctx: ValidationContext) => Transformed,
  ) {
    return {
      ...this,
      chain: [...this.chain, ['transform', fn]],
    };
  },

  to<T extends JSONTypeAny, ToType extends JSONTypeAny>(
    this: T,
    fn: (input: T['type']) => ToType['type'] | undefined,
    type: ToType,
  ): ToType {
    return {
      ...this,
      chain: [...this.chain, ['to', fn, type], ...type.chain],
    } as unknown as ToType;
  },

  refine(check) {
    return {
      ...this,
      chain: [...this.chain, ['refine', check]],
    };
  },

  superRefine(check) {
    return {
      ...this,
      chain: [...this.chain, ['superRefine', check]],
    };
  },

  and(type) {
    return intersection(this, type);
  },

  or(...args) {
    const [type, ...types] = args;
    return union([this, type, ...types]);
  },

  default(value) {
    const cloned = Object.create(this);
    cloned.data = { ...cloned.data, default: value };
    return cloned;
  },

  array() {
    return array(this);
  },
};

type BaseTypeProps<T extends JSONTypeAny> = Omit<
  JSONType<T['type']>,
  'dataType'
>;

export type OwnTypeProps<T extends JSONTypeAny> = Omit<
  T,
  keyof BaseTypeProps<T>
> & {
  [k in keyof BaseTypeProps<T>]?: BaseTypeProps<T>[k];
};

export const constructType = <T extends JSONTypeAny>(
  type: OwnTypeProps<T>,
): T => {
  return {
    ...(baseTypeMethods as BaseTypeProps<T>),
    ...type,
  } as T;
};
