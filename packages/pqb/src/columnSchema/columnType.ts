import { Operator, Operators } from '../operators';
import { EmptyObject } from './utils';

export type ColumnOutput<T extends ColumnType> = T['type'];

type Nullable<T extends ColumnType> = Omit<T, 'type' | 'operators'> & {
  type: T['type'] | null;
  isNullable: true;
  operators: Omit<T['operators'], 'equals' | 'not'> & {
    equals: Operator<T['type'] | null>;
    not: Operator<T['type'] | null>;
  };
};

export abstract class ColumnType<
  Type = unknown,
  Ops extends Operators = Operators,
> {
  abstract dataType: string;
  abstract operators: Ops;

  type!: Type;
  inputType!: Type;
  data = {} as EmptyObject;
  isPrimaryKey = false;
  isHidden = false;
  isNullable = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encodeFn?: (input: any) => unknown;
  parseFn?: (input: unknown) => unknown;

  primaryKey<T extends ColumnType>(this: T): T & { isPrimaryKey: true } {
    return Object.assign(this, { isPrimaryKey: true as const });
  }

  hidden<T extends ColumnType>(this: T): T & { isHidden: true } {
    return Object.assign(this, { isHidden: true as const });
  }

  nullable<T extends ColumnType>(this: T): Nullable<T> {
    this.isNullable = true;
    return this as unknown as Nullable<T>;
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
    return this as unknown as Omit<T, 'type'> & { type: Output };
  }

  toSQL() {
    return this.dataType;
  }
}
