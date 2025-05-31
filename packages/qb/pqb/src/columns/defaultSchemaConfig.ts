import {
  ColumnDataBase,
  ColumnSchemaConfig,
  ColumnTypeBase,
  EncodeColumn,
  MaybeArray,
  noop,
  ParseColumn,
  ParseNullColumn,
  PickColumnBaseData,
  setColumnData,
} from 'orchid-core';
import { DateColumn, TimestampColumn, TimestampTZColumn } from './dateTime';
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
  CitextColumn,
  MoneyColumn,
  StringColumn,
  TextColumn,
  VarCharColumn,
} from './string';
import { ColumnType } from './columnType';
import { setColumnParse, setColumnParseNull } from './column.utils';

export interface DefaultSchemaConfig extends ColumnSchemaConfig<ColumnType> {
  parse<T extends ColumnTypeBase, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): ParseColumn<T, unknown, Output>;

  parseNull<T extends ColumnTypeBase, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): ParseNullColumn<T, unknown, Output>;

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

  dateAsNumber<T extends ColumnType>(this: T): ParseColumn<T, unknown, number>;
  dateAsDate<T extends ColumnType>(this: T): ParseColumn<T, unknown, Date>;

  enum<T extends readonly string[]>(
    dataType: string,
    type: T,
  ): EnumColumn<DefaultSchemaConfig, unknown, T>;

  array<Item extends ArrayColumnValue>(
    item: Item,
  ): ArrayColumn<DefaultSchemaConfig, Item, unknown, unknown, unknown>;

  json<T>(): JSONColumn<
    // (#286) the default type shouldn't conform to a function,
    // because otherwise `update` can't differentiate between a function and non-function value
    unknown extends T ? MaybeArray<string | number | boolean | object> : T,
    DefaultSchemaConfig
  >;

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
  text(): TextColumn<DefaultSchemaConfig>;
  string(limit?: number): StringColumn<DefaultSchemaConfig>;
  citext(): CitextColumn<DefaultSchemaConfig>;

  date(): DateColumn<DefaultSchemaConfig>;
  timestampNoTZ(precision?: number): TimestampColumn<DefaultSchemaConfig>;
  timestamp(precision?: number): TimestampTZColumn<DefaultSchemaConfig>;
}

// parse a date string to date object, with respect to null
const parseDateToDate = (value: unknown): Date => new Date(value as string);

export const defaultSchemaConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parse(fn: (input: any) => unknown) {
    return setColumnParse(this as ColumnTypeBase, fn);
  },
  parseNull(fn: () => unknown) {
    return setColumnParseNull(this as ColumnTypeBase, fn);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encode(fn: (input: any) => unknown) {
    return setColumnData(this as PickColumnBaseData, 'encode', fn);
  },
  asType() {
    return this as never;
  },
  dateAsNumber(this: { data: ColumnDataBase; parse(fn: unknown): unknown }) {
    return this.parse(Date.parse) as ColumnTypeBase;
  },
  dateAsDate(this: { data: ColumnDataBase; parse(fn: unknown): unknown }) {
    return this.parse(parseDateToDate) as ColumnTypeBase;
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
  varchar: (limit: number) => new VarCharColumn(defaultSchemaConfig, limit),
  text: () => new TextColumn(defaultSchemaConfig),
  string: (limit?: number) => new StringColumn(defaultSchemaConfig, limit),
  citext: () => new CitextColumn(defaultSchemaConfig),

  date: () => new DateColumn(defaultSchemaConfig),
  timestampNoTZ: (precision?: number) =>
    new TimestampColumn(defaultSchemaConfig, precision),
  timestamp: (precision?: number) =>
    new TimestampTZColumn(defaultSchemaConfig, precision),

  geographyPointSchema: noop,
} as unknown as DefaultSchemaConfig;
