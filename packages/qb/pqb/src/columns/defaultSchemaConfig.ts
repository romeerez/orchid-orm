import {
  ColumnSchemaConfig,
  ColumnTypeBase,
  EncodeColumn,
  noop,
  ParseColumn,
  setColumnData,
} from 'orchid-core';
import {
  DateBaseColumn,
  DateColumn,
  TimestampColumn,
  TimestampTZColumn,
} from './dateTime';
import { EnumColumn } from './enum';
import { ArrayColumn, ArrayColumnValue } from './array';
import { JSONColumn } from './json';
import {
  BigIntColumn,
  BigSerialColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  IntegerColumn,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
} from './number';
import {
  CharColumn,
  CitextColumn,
  MoneyColumn,
  StringColumn,
  TextColumn,
  VarCharColumn,
} from './string';
import { ColumnType } from './columnType';

export interface DefaultSchemaConfig extends ColumnSchemaConfig<ColumnType> {
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
      inputType: unknown;
      outputType: unknown;
      queryType: unknown;
    },
  >(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _fn: (
      type: <Type, Input = Type, Output = Type, Query = Type>() => {
        type: Type;
        inputType: Input;
        outputType: Output;
        queryType: Query;
      },
    ) => Types,
  ): { [K in keyof T]: K extends keyof Types ? Types[K] : T[K] };

  dateAsNumber(): ParseColumn<
    DateBaseColumn<DefaultSchemaConfig>,
    unknown,
    number
  >;

  dateAsDate(): ParseColumn<DateBaseColumn<DefaultSchemaConfig>, unknown, Date>;

  enum<U extends string, T extends readonly [U, ...U[]]>(
    dataType: string,
    type: T,
  ): EnumColumn<DefaultSchemaConfig, unknown, U, T>;

  array<Item extends ArrayColumnValue>(
    item: Item,
  ): ArrayColumn<DefaultSchemaConfig, Item, unknown, unknown, unknown>;

  json<T>(): JSONColumn<T, DefaultSchemaConfig>;

  inputSchema(): undefined;
  outputSchema(): undefined;
  querySchema(): undefined;
  updateSchema(): undefined;
  pkeySchema(): undefined;

  smallint(): SmallIntColumn<DefaultSchemaConfig>;
  integer(): IntegerColumn<DefaultSchemaConfig>;
  real(): RealColumn<DefaultSchemaConfig>;
  smallSerial(): SmallSerialColumn<DefaultSchemaConfig>;
  serial(): SerialColumn<DefaultSchemaConfig>;

  bigint(): BigIntColumn<DefaultSchemaConfig>;
  decimal(
    precision?: number,
    scale?: number,
  ): DecimalColumn<DefaultSchemaConfig>;
  doublePrecision(): DoublePrecisionColumn<DefaultSchemaConfig>;
  bigSerial(): BigSerialColumn<DefaultSchemaConfig>;
  money(): MoneyColumn<DefaultSchemaConfig>;
  varchar(limit?: number): VarCharColumn<DefaultSchemaConfig>;
  char(limit?: number): CharColumn<DefaultSchemaConfig>;
  text(min: number, max: number): TextColumn<DefaultSchemaConfig>;
  string(limit?: number): StringColumn<DefaultSchemaConfig>;
  citext(min: number, max: number): CitextColumn<DefaultSchemaConfig>;

  date(): DateColumn<DefaultSchemaConfig>;
  timestampNoTZ(precision?: number): TimestampColumn<DefaultSchemaConfig>;
  timestamp(precision?: number): TimestampTZColumn<DefaultSchemaConfig>;
}

// parse a date string to number, with respect to null
const parseDateToNumber = (value: unknown): number =>
  (value ? Date.parse(value as string) : value) as number;

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown): Date =>
  (value ? new Date(value as string) : value) as Date;

(parseDateToNumber as unknown as { hideFromCode: boolean }).hideFromCode = (
  parseDateToDate as unknown as { hideFromCode: boolean }
).hideFromCode = true;

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
  enum<T extends readonly [string, ...string[]]>(dataType: string, type: T) {
    return new EnumColumn(defaultSchemaConfig, dataType, type, undefined);
  },
  array<Item extends ArrayColumnValue>(item: Item) {
    return new ArrayColumn(defaultSchemaConfig, item, undefined);
  },
  boolean: noop,
  buffer: noop,
  unknown: noop,
  never: noop,
  stringSchema: noop,
  stringMin: noop,
  stringMax: noop,
  stringMinMax: noop,
  number: noop,
  int: noop,
  stringNumberDate: noop,
  timeInterval: noop,
  bit: noop,
  uuid: noop,
  nullable(this: ColumnTypeBase) {
    return setColumnData(this, 'isNullable', true);
  },
  json() {
    return new JSONColumn(defaultSchemaConfig, undefined);
  },
  setErrors: noop,

  smallint: () => new SmallIntColumn(defaultSchemaConfig),
  integer: () => new IntegerColumn(defaultSchemaConfig),
  real: () => new RealColumn(defaultSchemaConfig),
  smallSerial: () => new SmallSerialColumn(defaultSchemaConfig),
  serial: () => new SerialColumn(defaultSchemaConfig),

  bigint: () => new BigIntColumn(defaultSchemaConfig),
  decimal: (precision?: number, scale?: number) =>
    new DecimalColumn(defaultSchemaConfig, precision, scale),
  doublePrecision: () => new DoublePrecisionColumn(defaultSchemaConfig),
  bigSerial: () => new BigSerialColumn(defaultSchemaConfig),
  money: () => new MoneyColumn(defaultSchemaConfig),
  varchar: (limit?: number) => new VarCharColumn(defaultSchemaConfig, limit),
  char: (limit?: number) => new CharColumn(defaultSchemaConfig, limit),
  text: (min: number, max: number) =>
    new TextColumn(defaultSchemaConfig, min, max),
  string: (limit?: number) => new StringColumn(defaultSchemaConfig, limit),
  citext: (min: number, max: number) =>
    new CitextColumn(defaultSchemaConfig, min, max),

  date: () => new DateColumn(defaultSchemaConfig),
  timestampNoTZ: (precision?: number) =>
    new TimestampColumn(defaultSchemaConfig, precision),
  timestamp: (precision?: number) =>
    new TimestampTZColumn(defaultSchemaConfig, precision),
} as unknown as DefaultSchemaConfig;
