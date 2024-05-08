import { IdentityColumn, IntegerColumn } from './number';
import {
  BitColumn,
  BitVaryingColumn,
  BoxColumn,
  ByteaColumn,
  CidrColumn,
  CircleColumn,
  InetColumn,
  LineColumn,
  LsegColumn,
  MacAddr8Column,
  MacAddrColumn,
  PathColumn,
  PointColumn,
  PolygonColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  XMLColumn,
} from './string';
import { IntervalColumn, TimeColumn } from './dateTime';
import { BooleanColumn } from './boolean';
import { JSONTextColumn } from './json';
import {
  ColumnSchemaConfig,
  makeTimestampsHelpers,
  QueryColumnsInit,
  setCurrentColumnName,
  setDefaultLanguage,
  setDefaultNowFn,
  TimestampHelpers,
} from 'orchid-core';
import { makeRegexToFindInSql } from '../common/utils';
import { CustomTypeColumn, DomainColumn } from './customType';
import { RawSQL, sqlFn, SqlFn } from '../sql/rawSql';
import { TableData } from '../tableData';

export const getColumnTypes = <ColumnTypes, Shape extends QueryColumnsInit>(
  types: ColumnTypes,
  fn: (t: ColumnTypes) => Shape,
  nowSQL: string | undefined,
  language: string | undefined,
): Shape => {
  if (nowSQL) setDefaultNowFn(nowSQL);
  if (language) setDefaultLanguage(language);
  return fn(types);
};

export interface DefaultColumnTypes<SchemaConfig extends ColumnSchemaConfig>
  extends TimestampHelpers {
  schema: SchemaConfig;
  enum: SchemaConfig['enum'];
  array: SchemaConfig['array'];

  name<T>(this: T, name: string): T;

  sql: SqlFn;

  smallint: SchemaConfig['smallint'];
  integer: SchemaConfig['integer'];
  bigint: SchemaConfig['bigint'];
  numeric: SchemaConfig['decimal'];
  decimal: SchemaConfig['decimal'];
  real: SchemaConfig['real'];
  doublePrecision: SchemaConfig['doublePrecision'];
  identity(
    options?: TableData.Identity,
  ): IdentityColumn<ReturnType<SchemaConfig['integer']>>;
  smallSerial: SchemaConfig['smallSerial'];
  serial: SchemaConfig['serial'];
  bigSerial: SchemaConfig['bigSerial'];
  money: SchemaConfig['money'];
  varchar: SchemaConfig['varchar'];
  char: SchemaConfig['char'];
  text: SchemaConfig['text'];
  // `varchar` column with optional limit defaulting to 255.
  string: SchemaConfig['string'];
  citext: SchemaConfig['citext'];
  bytea(): ByteaColumn<SchemaConfig>;
  date: SchemaConfig['date'];
  timestampNoTZ: SchemaConfig['timestampNoTZ'];
  timestamp: SchemaConfig['timestamp'];
  time(precision?: number): TimeColumn<SchemaConfig>;
  interval(fields?: string, precision?: number): IntervalColumn<SchemaConfig>;
  boolean(): BooleanColumn<SchemaConfig>;
  point(): PointColumn<SchemaConfig>;
  line(): LineColumn<SchemaConfig>;
  lseg(): LsegColumn<SchemaConfig>;
  box(): BoxColumn<SchemaConfig>;
  path(): PathColumn<SchemaConfig>;
  polygon(): PolygonColumn<SchemaConfig>;
  circle(): CircleColumn<SchemaConfig>;
  cidr(): CidrColumn<SchemaConfig>;
  inet(): InetColumn<SchemaConfig>;
  macaddr(): MacAddrColumn<SchemaConfig>;
  macaddr8(): MacAddr8Column<SchemaConfig>;
  bit(length: number): BitColumn<SchemaConfig>;
  bitVarying(length?: number): BitVaryingColumn<SchemaConfig>;
  tsvector(): TsVectorColumn<SchemaConfig>;
  tsquery(): TsQueryColumn<SchemaConfig>;
  uuid(): UUIDColumn<SchemaConfig>;
  xml(): XMLColumn<SchemaConfig>;
  json: SchemaConfig['json'];
  jsonText(): JSONTextColumn<SchemaConfig>;
  type(dataType: string): CustomTypeColumn<SchemaConfig>;
  domain(dataType: string): DomainColumn<SchemaConfig>;
}

export const makeColumnTypes = <SchemaConfig extends ColumnSchemaConfig>(
  schema: SchemaConfig,
): DefaultColumnTypes<SchemaConfig> => {
  return {
    schema,
    enum: schema.enum,
    array: schema.array,

    name(name: string) {
      setCurrentColumnName(name);
      return this;
    },

    sql: sqlFn,

    smallint: schema.smallint,
    integer: schema.integer,
    bigint: schema.bigint,
    numeric: schema.decimal,
    decimal: schema.decimal,
    real: schema.real,
    doublePrecision: schema.doublePrecision,
    identity(options) {
      return (schema.integer() as IntegerColumn<SchemaConfig>).identity(
        options,
      ) as never;
    },
    smallSerial: schema.smallSerial,
    serial: schema.serial,
    bigSerial: schema.bigSerial,
    money: schema.money,
    varchar: schema.varchar,
    char: schema.char,
    text: schema.text,
    string: schema.string,
    citext: schema.citext,
    bytea() {
      return new ByteaColumn<SchemaConfig>(schema);
    },
    date: schema.date,
    timestampNoTZ: schema.timestampNoTZ,
    timestamp: schema.timestamp,
    time(precision) {
      return new TimeColumn<SchemaConfig>(schema, precision);
    },
    interval(fields, precision) {
      return new IntervalColumn<SchemaConfig>(schema, fields, precision);
    },
    boolean() {
      return new BooleanColumn<SchemaConfig>(schema);
    },
    point() {
      return new PointColumn<SchemaConfig>(schema);
    },
    line() {
      return new LineColumn<SchemaConfig>(schema);
    },
    lseg() {
      return new LsegColumn<SchemaConfig>(schema);
    },
    box() {
      return new BoxColumn<SchemaConfig>(schema);
    },
    path() {
      return new PathColumn<SchemaConfig>(schema);
    },
    polygon() {
      return new PolygonColumn<SchemaConfig>(schema);
    },
    circle() {
      return new CircleColumn<SchemaConfig>(schema);
    },
    cidr() {
      return new CidrColumn<SchemaConfig>(schema);
    },
    inet() {
      return new InetColumn<SchemaConfig>(schema);
    },
    macaddr() {
      return new MacAddrColumn<SchemaConfig>(schema);
    },
    macaddr8() {
      return new MacAddr8Column<SchemaConfig>(schema);
    },
    bit(length) {
      return new BitColumn<SchemaConfig>(schema, length);
    },
    bitVarying(length) {
      return new BitVaryingColumn<SchemaConfig>(schema, length);
    },
    tsvector() {
      return new TsVectorColumn<SchemaConfig>(schema);
    },
    tsquery() {
      return new TsQueryColumn<SchemaConfig>(schema);
    },
    uuid() {
      return new UUIDColumn<SchemaConfig>(schema);
    },
    xml() {
      return new XMLColumn<SchemaConfig>(schema);
    },
    json: schema.json,
    jsonText() {
      return new JSONTextColumn<SchemaConfig>(schema);
    },
    type(dataType) {
      return new CustomTypeColumn<SchemaConfig>(schema, dataType);
    },
    domain(dataType) {
      return new DomainColumn<SchemaConfig>(schema, dataType);
    },

    ...makeTimestampsHelpers(makeRegexToFindInSql),
  };
};

RawSQL.prototype.columnTypes = makeColumnTypes;
