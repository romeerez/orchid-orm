import {
  DateColumn,
  TimestampColumn,
  TimestampTZColumn,
} from './column-types/date-time';
import { EnumColumn } from './column-types/enum';
import { ArrayColumn, ArrayColumnValue } from './column-types/array';
import { JSONColumn } from './column-types/json';
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
} from './column-types/number';
import {
  CitextColumn,
  MoneyColumn,
  StringColumn,
  TextColumn,
  VarCharColumn,
} from './column-types/string';
import { Column, setColumnData } from './column';
import { setColumnParse, setColumnParseNull } from './column.utils';
import { ColumnSchemaConfig } from './column-schema';
import { MaybeArray, noop } from '../utils';

export interface DefaultSchemaConfig extends ColumnSchemaConfig<Column> {
  parse<T extends Column.Pick.ForParse, Output>(
    this: T,
    fn: (input: T['type']) => Output,
  ): Column.Modifiers.Parse<T, unknown, Output>;

  parseNull<T extends Column.Pick.ForParseNull, Output>(
    this: T,
    fn: () => Output,
  ): Column.Modifiers.ParseNull<T, unknown, Output>;

  encode<T extends { type: unknown }, Input>(
    this: T,
    fn: (input: Input) => unknown,
  ): Column.Modifiers.Encode<T, unknown, Input>;

  /**
   * @deprecated use narrowType instead
   */
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

  narrowType<
    T extends Column.InputOutputQueryTypes,
    Types extends Column.InputOutputQueryTypes,
  >(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _fn: (
      type: <
        Type extends T['inputType'] extends T['outputType'] & T['queryType']
          ? T['outputType'] & T['queryType'] // generated column case
          : T['inputType'] & T['outputType'] & T['queryType'],
      >() => {
        inputType: T['inputType'] extends never ? never : Type;
        outputType: Type;
        queryType: Type;
      },
    ) => Types,
  ): { [K in keyof T]: K extends keyof Types ? Types[K] : T[K] };

  narrowAllTypes<
    T extends Column.InputOutputQueryTypes,
    Types extends Column.InputOutputQueryTypes,
  >(
    this: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _fn: (
      type: <
        Types extends {
          input?: T['inputType'];
          output?: T['outputType'];
          query?: T['queryType'];
        },
      >() => {
        inputType: undefined extends Types['input']
          ? T['inputType']
          : Types['input'];
        outputType: undefined extends Types['output']
          ? T['outputType']
          : Types['output'];
        queryType: undefined extends Types['query']
          ? T['queryType']
          : Types['query'];
      },
    ) => Types,
  ): { [K in keyof T]: K extends keyof Types ? Types[K] : T[K] };

  dateAsNumber<T extends Column>(
    this: T,
  ): Column.Modifiers.Parse<T, unknown, number>;
  dateAsDate<T extends Column>(
    this: T,
  ): Column.Modifiers.Parse<T, unknown, Date>;

  enum<const T extends readonly [string, ...string[]]>(
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
    return setColumnParse(this as never, fn);
  },
  parseNull(fn: () => unknown) {
    return setColumnParseNull(this as never, fn);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encode(fn: (input: any) => unknown) {
    return setColumnData(this as Column.Pick.Data, 'encode', fn);
  },
  asType() {
    return this as never;
  },
  narrowType() {
    return this as never;
  },
  narrowAllTypes() {
    return this as never;
  },
  dateAsNumber(this: { data: Column.Data; parse(fn: unknown): unknown }) {
    return this.parse(Date.parse) as never;
  },
  dateAsDate(this: { data: Column.Data; parse(fn: unknown): unknown }) {
    return this.parse(parseDateToDate) as never;
  },
  enum<const T extends readonly [string, ...string[]]>(
    dataType: string,
    type: T,
  ) {
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
  nullable(this: Column.Pick.ForNullable) {
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
