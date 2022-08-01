import { Operators } from '../operators';
import { EmptyObject } from './utils';

export type ColumnOutput<T extends ColumnType> = T['type'];

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

  nullable<T extends ColumnType>(
    this: T,
  ): Omit<T, 'type'> & { type: T['type'] | null; isNullable: true } {
    this.isNullable = true;
    return this as T & { isNullable: true };
  }

  encode<T extends ColumnType, Input>(fn: (input: Input) => T['type']) {
    const self = this as unknown as Omit<T, 'inputType'> & { inputType: Input };
    self.encodeFn = fn;
    return self;
  }

  parse<T extends ColumnType, Output>(fn: (input: T['type']) => Output) {
    this.parseFn = fn;
    return this as unknown as Omit<T, 'type'> & { type: Output };
  }

  toSQL() {
    return this.dataType;
  }
}
