import { ColumnSchemaConfig, ColumnTypeBase } from '../core';
import { makeColumnTypes } from './columnTypes';
import { ColumnType } from './columnType';

export interface ColumnsByType {
  [K: string]: () => ColumnTypeBase;
}

export const makeColumnsByType = (schema: ColumnSchemaConfig) => {
  const t = makeColumnTypes(schema);

  // not implementing char, character, bpchar
  return {
    bool: t.boolean,
    boolean: t.boolean,
    bytea: t.bytea,
    int8: t.bigint,
    bigint: t.bigint,
    int2: t.smallint,
    smallint: t.smallint,
    int4: t.integer,
    integer: t.integer,
    text: t.text,
    json: t.jsonText,
    xml: t.xml,
    point: t.point,
    lseg: t.lseg,
    path: t.path,
    box: t.box,
    polygon: t.polygon,
    line: t.line,
    cidr: t.cidr,
    float4: t.real,
    real: t.real,
    float8: t.doublePrecision,
    'double precision': t.doublePrecision,
    circle: t.circle,
    macaddr8: t.macaddr8,
    money: t.money,
    macaddr: t.macaddr,
    inet: t.inet,
    varchar: t.varchar,
    'character varying': t.varchar,
    date: t.date,
    time: t.time,
    'time without time zone': t.time,
    timestamp: t.timestampNoTZ,
    'timestamp without time zone': t.timestampNoTZ,
    timestamptz: t.timestamp,
    'timestamp with time zone': t.timestamp,
    interval: t.interval,
    bit() {
      return t.bit(Infinity);
    },
    varbit: t.bitVarying,
    'bit varying': t.bitVarying,
    numeric: t.decimal,
    decimal: t.decimal,
    uuid: t.uuid,
    tsvector: t.tsvector,
    tsquery: t.tsquery,
    jsonb: schema.json as () => ColumnType,
    smallserial: t.smallSerial,
    serial: t.serial,
    bigserial: t.bigSerial,
    // requires citext extension
    citext: t.citext,
    geographyDefaultPoint: t.geography.point,
  } as ColumnsByType;
};
