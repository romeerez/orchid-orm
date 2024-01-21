import {
  ColumnSchemaConfig,
  ColumnTypeBase,
  EncodeColumn,
  noop,
  ParseColumn,
  setColumnData,
} from 'orchid-core';
import { DateBaseColumn } from './dateTime';
import { EnumColumn } from './enum';
import { ArrayColumn, ArrayColumnValue } from './array';
import { ColumnType } from './columnType';
import { JSONColumn } from './json';

type ParseDateToNumber = ParseColumn<
  DateBaseColumn<DefaultSchemaConfig>,
  unknown,
  number
>;

type ParseDateToDate = ParseColumn<
  DateBaseColumn<DefaultSchemaConfig>,
  unknown,
  Date
>;

export interface DefaultSchemaConfig extends ColumnSchemaConfig {
  parse<T extends { type: unknown }, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): ParseColumn<T, unknown, Output>;

  encode<T extends { type: unknown }, Input>(
    this: T,
    fn: (input: Input) => unknown,
  ): EncodeColumn<T, unknown, Input>;

  asType<
    T,
    Types extends {
      type: unknown;
      input: unknown;
      output: unknown;
      query: unknown;
    },
  >(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _fn: (
      type: <Type, Input = Type, Output = Type, Query = Type>() => {
        type: Type;
        input: Input;
        output: Output;
        query: Query;
      },
    ) => Types,
  ): Omit<T, 'type' | 'inputType' | 'outputType' | 'queryType'> & Types;

  dateAsNumber(): ParseDateToNumber;

  dateAsDate(): ParseDateToDate;

  enum<U extends string, T extends [U, ...U[]]>(
    dataType: string,
    type: T,
  ): EnumColumn<DefaultSchemaConfig, unknown, U, T>;

  array<Item extends ArrayColumnValue>(
    item: Item,
  ): ArrayColumn<DefaultSchemaConfig, Item, unknown, unknown, unknown>;

  json(): ColumnType;

  inputSchema(): undefined;
  outputSchema(): undefined;
  querySchema(): undefined;
}

// parse a date string to number, with respect to null
const parseDateToNumber = (value: unknown) =>
  (value ? Date.parse(value as string) : value) as number;

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown) =>
  (value ? new Date(value as string) : value) as Date;

export const defaultSchemaConfig = {
  parse(fn: unknown) {
    return Object.assign(Object.create(this), {
      parseFn: fn,
      parseItem: fn,
    });
  },
  encode(fn: unknown) {
    return Object.assign(Object.create(this), {
      encodeFn: fn,
    });
  },
  asType() {
    return this as never;
  },
  dateAsNumber(this: { parse(fn: unknown): unknown }) {
    return this.parse(parseDateToNumber);
  },
  dateAsDate(this: { parse(fn: unknown): unknown }) {
    return this.parse(parseDateToDate);
  },
  enum<T extends [string, ...string[]]>(dataType: string, type: T) {
    return new EnumColumn(defaultSchemaConfig, dataType, type, undefined);
  },
  array<Item extends ArrayColumnValue>(item: Item) {
    return new ArrayColumn(defaultSchemaConfig, item, undefined);
  },
  nullable(this: ColumnTypeBase) {
    return setColumnData(this, 'isNullable', true);
  },
  json() {
    return new JSONColumn(defaultSchemaConfig, undefined);
  },
  setErrors: noop,
} as unknown as DefaultSchemaConfig;
