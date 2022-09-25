import { Operator, Operators } from '../columnsOperators';
import { JSONTypeAny } from './json/typeBase';

export type ColumnOutput<T extends ColumnType> = T['type'];

export type ColumnInput<T extends ColumnType> = T['inputType'];

export type NullableColumn<T extends ColumnType> = Omit<
  T,
  'type' | 'inputType' | 'operators'
> & {
  type: T['type'] | null;
  inputType: T['inputType'] | null;
  isNullable: true;
  operators: Omit<T['operators'], 'equals' | 'not'> & {
    equals: Operator<T['type'] | null>;
    not: Operator<T['type'] | null>;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnType = ColumnType<any, Record<string, Operator<any>>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyColumnTypeCreator = (...args: any[]) => AnyColumnType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationContext = any;

export type ColumnData = {
  default?: unknown;
};

export abstract class ColumnType<
  Type = unknown,
  Ops extends Operators = Operators,
  InputType = Type,
> {
  abstract dataType: string;
  abstract operators: Ops;

  type!: Type;
  inputType!: InputType;
  data = {} as ColumnData;
  isPrimaryKey = false;
  isHidden = false;
  isNullable = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encodeFn?: (input: any) => unknown;
  parseFn?: (input: unknown) => unknown;
  // parse item in array:
  parseItem?: (input: string) => unknown;

  chain = [] as (
    | ['transform', (input: unknown, ctx: ValidationContext) => unknown]
    | ['to', (input: unknown) => JSONTypeAny | undefined, JSONTypeAny]
    | ['refine', (input: unknown) => unknown]
    | ['superRefine', (input: unknown, ctx: ValidationContext) => unknown]
  )[];

  primaryKey<T extends ColumnType>(this: T): T & { isPrimaryKey: true } {
    return Object.assign(this, { isPrimaryKey: true as const });
  }

  hidden<T extends ColumnType>(this: T): T & { isHidden: true } {
    return Object.assign(this, { isHidden: true as const });
  }

  nullable<T extends ColumnType>(this: T): NullableColumn<T> {
    this.isNullable = true;
    return this as unknown as NullableColumn<T>;
  }

  encode<T extends ColumnType, Input>(
    this: T,
    fn: (input: Input) => unknown,
  ): Omit<T, 'inputType'> & { inputType: Input } {
    const self = this as unknown as Omit<T, 'inputType'> & { inputType: Input };
    self.encodeFn = fn;
    return self;
  }

  parse<T extends ColumnType, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): Omit<T, 'type'> & { type: Output } {
    this.parseFn = fn;
    this.parseItem = fn;
    return this as unknown as Omit<T, 'type'> & { type: Output };
  }

  toSQL() {
    return this.dataType;
  }

  default<T extends ColumnType>(this: T, value: T['type']) {
    const cloned = Object.create(this);
    cloned.data = { ...cloned.data, default: value };
    return cloned;
  }

  transform<T extends ColumnType, Transformed>(
    this: T,
    fn: (input: T['type'], ctx: ValidationContext) => Transformed,
  ): Omit<T, 'type'> & { type: Transformed } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['transform', fn]];
    return cloned as Omit<T, 'type'> & { type: Transformed };
  }

  to<T extends ColumnType, ToType extends ColumnType>(
    this: T,
    fn: (input: T['type']) => ToType['type'] | undefined,
    type: ToType,
  ): ToType {
    const cloned = Object.create(type);
    cloned.chain = [...this.chain, ['to', fn, type], ...cloned.chain];
    return cloned as ToType;
  }

  refine<T extends ColumnType, RefinedOutput extends T['type']>(
    this: T,
    check: (arg: T['type']) => unknown,
  ): T & { type: RefinedOutput } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['refine', check]];
    return cloned as T & { type: RefinedOutput };
  }

  superRefine<T extends ColumnType, RefinedOutput extends T['type']>(
    this: T,
    check: (arg: T['type'], ctx: ValidationContext) => unknown,
  ): T & { type: RefinedOutput } {
    const cloned = Object.create(this);
    cloned.chain = [...this.chain, ['superRefine', check]];
    return cloned as T & { type: RefinedOutput };
  }
}
