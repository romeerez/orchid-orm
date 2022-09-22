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
  BitColumn,
  BitVaryingColumn,
  BoxColumn,
  ByteaColumn,
  CharColumn,
  CidrColumn,
  CircleColumn,
  InetColumn,
  LineColumn,
  LsegColumn,
  MacAddrColumn,
  MacAddr8Column,
  MoneyColumn,
  PathColumn,
  PointColumn,
  PolygonColumn,
  TextColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  VarCharColumn,
  XMLColumn,
} from './string';
import {
  DateColumn,
  IntervalColumn,
  TimeColumn,
  TimestampColumn,
  TimestampWithTimeZoneColumn,
  TimeWithTimeZoneColumn,
} from './dateTime';
import { BooleanColumn } from './boolean';
import { EnumColumn } from './enum';
import { JSONColumn, JSONTextColumn, JSONTypes } from './json';
import { JSONTypeAny } from './json/typeBase';
import { ArrayColumn } from './array';
import { ColumnType } from './columnType';

export type ColumnTypes = typeof columnTypes;

export const columnTypes = {
  smallint: () => new SmallIntColumn(),
  integer: () => new IntegerColumn(),
  bigint: () => new BigIntColumn(),
  numeric: <
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(
    precision?: Precision,
    scale?: Scale,
  ) => new DecimalColumn(precision, scale),
  decimal: <
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(
    precision?: Precision,
    scale?: Scale,
  ) => new DecimalColumn(precision, scale),
  real: () => new RealColumn(),
  doublePrecision: () => new DoublePrecisionColumn(),
  smallSerial: () => new SmallSerialColumn(),
  serial: () => new SerialColumn(),
  bigSerial: () => new BigSerialColumn(),
  money: () => new MoneyColumn(),
  varchar: <Limit extends number | undefined = undefined>(limit?: Limit) =>
    new VarCharColumn(limit),
  char: <Limit extends number | undefined = undefined>(limit?: Limit) =>
    new CharColumn(limit),
  text: () => new TextColumn(),
  string: () => new TextColumn(),
  bytea: () => new ByteaColumn(),
  date: () => new DateColumn(),
  timestamp: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimestampColumn(precision),
  timestampWithTimeZone: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimestampWithTimeZoneColumn(precision),
  time: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimeColumn(precision),
  timeWithTimeZone: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimeWithTimeZoneColumn(precision),
  interval: <
    Fields extends string | undefined = undefined,
    Precision extends number | undefined = undefined,
  >(
    fields?: Fields,
    precision?: Precision,
  ) => new IntervalColumn(fields, precision),
  boolean: () => new BooleanColumn(),
  enum: <U extends string, T extends [U, ...U[]]>(dataType: string, type: T) =>
    new EnumColumn<U, T>(dataType, type),
  point: () => new PointColumn(),
  line: () => new LineColumn(),
  lseg: () => new LsegColumn(),
  box: () => new BoxColumn(),
  path: () => new PathColumn(),
  polygon: () => new PolygonColumn(),
  circle: () => new CircleColumn(),
  cidr: () => new CidrColumn(),
  inet: () => new InetColumn(),
  macaddr: () => new MacAddrColumn(),
  macaddr8: () => new MacAddr8Column(),
  bit: <Length extends number>(length: Length) => new BitColumn(length),
  bitVarying: <Length extends number | undefined = undefined>(
    length?: Length,
  ) => new BitVaryingColumn(length),
  tsvector: () => new TsVectorColumn(),
  tsquery: () => new TsQueryColumn(),
  uuid: () => new UUIDColumn(),
  xml: () => new XMLColumn(),
  json: <Type extends JSONTypeAny>(
    schemaOrFn: Type | ((j: JSONTypes) => Type),
  ) => new JSONColumn(schemaOrFn),
  jsonText: () => new JSONTextColumn(),
  array: <Item extends ColumnType>(item: Item) => new ArrayColumn(item),
};
