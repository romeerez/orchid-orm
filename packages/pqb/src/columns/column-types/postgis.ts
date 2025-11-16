import { ColumnToCodeCtx } from '../../core';
import { Code } from '../code';
import { ColumnType } from '../column-type';
import { Operators, OperatorsAny } from '../operators';
import { columnCode } from '../code';
import { setColumnDefaultParse } from '../column.utils';
import { ColumnSchemaConfig } from '../column-schema';

const defaultSrid = 4326;

export interface PostgisPoint {
  lon: number;
  lat: number;
  srid?: number;
}

const encode = ({ srid = defaultSrid, lon, lat }: PostgisPoint): string => {
  const arr = new Uint8Array(25);
  const view = new DataView(arr.buffer);

  // first byte 01 indicates little-endian
  view.setInt8(0, 1);

  // geometry type Point
  view.setInt8(1, 1);
  // it's a part of geom type, not sure why it's 32
  view.setInt8(4, 32);

  view.setUint32(5, srid, true);
  view.setFloat64(9, lon, true);
  view.setFloat64(17, lat, true);

  return uint8ArrToHex(arr);
};

export class PostgisGeographyPointColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  PostgisPoint,
  ReturnType<Schema['geographyPointSchema']>,
  OperatorsAny
> {
  dataType = 'geography(Point)';
  operators = Operators.any;

  // It is used by test-factory
  static encode = encode;

  static isDefaultPoint(typmod: number) {
    return typmodType(typmod) === 'Point' && typmodSrid(typmod) === defaultSrid;
  }

  constructor(schema: Schema) {
    super(schema, schema.geographyPointSchema() as never);
    setColumnDefaultParse(this, parse);
    this.data.encode = encode;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `geography.point()`);
  }
}

const parse = (input: string): PostgisPoint => {
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 40; i += 2) {
    bytes[i / 2] = parseInt(input.slice(10 + i, 12 + i), 16);
  }
  const view = new DataView(bytes.buffer);

  const srid = view.getUint32(0, true);
  const lon = view.getFloat64(4, true);
  const lat = view.getFloat64(12, true);

  return srid === defaultSrid
    ? { lon, lat }
    : {
        lon,
        lat,
        srid,
      };
};

const typmodGetType = (typmod: number) => (typmod & 0x000000fc) >> 2;

const lwtypeName = (type: number) =>
  [
    'Unknown',
    'Point',
    'LineString',
    'Polygon',
    'MultiPoint',
    'MultiLineString',
    'MultiPolygon',
    'GeometryCollection',
    'CircularString',
    'CompoundCurve',
    'CurvePolygon',
    'MultiCurve',
    'MultiSurface',
    'PolyhedralSurface',
    'Triangle',
    'Tin',
  ][type] || 'Invalid type';

const typmodGetZ = (typmod: number) => (typmod & 0x00000002) >> 1;

const typmodGetM = (typmod: number) => typmod & 0x00000001;

const typmodType = (typmod: number) => {
  const type = typmodGetType(typmod);

  let s = '';

  if (typmod < 0 || type === 0) {
    s += 'Geometry';
  } else {
    s += lwtypeName(type);
  }

  if (typmod >= 0 && typmodGetZ(typmod)) s += 'Z';

  if (typmod >= 0 && typmodGetM(typmod)) s += 'M';

  return s;
};

const typmodSrid = (typmod: number) => {
  return typmod < 0 ? 0 : ((typmod & 0x0fffff00) - (typmod & 0x10000000)) >> 8;
};

export const postgisTypmodToSql = (typmod: number) => {
  const srid = typmodSrid(typmod);
  return typmodType(typmod) + (srid === defaultSrid ? '' : ', ' + srid);
};

let byteToHex: string[] | undefined;
function uint8ArrToHex(arr: Uint8Array) {
  if (!byteToHex) {
    byteToHex = [];
    for (let n = 0; n <= 0xff; ++n) {
      const hexOctet = n.toString(16).padStart(2, '0');
      byteToHex.push(hexOctet);
    }
  }

  const hexOctets = [];

  for (let i = 0; i < arr.length; ++i) hexOctets.push(byteToHex[arr[i]]);

  return hexOctets.join('');
}
