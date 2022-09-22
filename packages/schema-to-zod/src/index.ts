import { ArrayColumn, ColumnType, EnumColumn } from 'pqb';
import { z } from 'zod';
import { Buffer } from 'node:buffer';

type NumberType =
  | 'smallint'
  | 'integer'
  | 'real'
  | 'smallserial'
  | 'serial'
  | 'money';

type BigIntType =
  | 'bigint'
  | 'numeric'
  | 'decimal'
  | 'double precision'
  | 'bigserial';

type StringType = 'varchar' | 'char' | 'text' | 'string' | 'xml' | 'json';

type DateTimeType = 'date' | 'timestamp' | 'timestamp with time zone';

type TimeType = 'time' | 'time with time zone';

type GeometryType =
  | 'point'
  | 'line'
  | 'lseg'
  | 'box'
  | 'path'
  | 'polygon'
  | 'circle';

type NetworkType = 'cidr' | 'inet' | 'macaddr' | 'macaddr8';

type BitStringType = 'bit' | 'bit varying';

type FullTextSearchType = 'tsvector' | 'tsquery';

type UUIDType = 'uuid';

type ByteaType = 'bytea';

type SchemaToZod<T extends ColumnType, D = T['dataType']> = D extends NumberType
  ? z.ZodNumber
  : D extends
      | BigIntType
      | StringType
      | TimeType
      | GeometryType
      | NetworkType
      | BitStringType
      | FullTextSearchType
      | UUIDType
  ? z.ZodString
  : D extends ByteaType
  ? z.ZodType<Buffer>
  : D extends DateTimeType
  ? z.ZodDate
  : D extends 'interval'
  ? typeof interval
  : D extends 'boolean'
  ? z.ZodBoolean
  : T extends EnumColumn<string, infer U>
  ? z.ZodEnum<U>
  : T extends ArrayColumn<infer U>
  ? z.ZodArray<SchemaToZod<U>>
  : never;

export const schemaToZod = <T extends ColumnType>(
  column: T,
): SchemaToZod<T> => {
  const converter = converters[column.dataType];
  if (!converter) throw new Error(`Cannot parse column ${column.dataType}`);
  return converter(column) as SchemaToZod<T>;
};

const handleString = (column: ColumnType) => {
  return z.string();
};

const handleNumber = (column: ColumnType) => {
  return z.number();
};

const handleBigInt = (column: ColumnType) => {
  return z.string().refine(
    (value) => {
      try {
        BigInt(value);
        return true;
      } catch (_) {
        return false;
      }
    },
    {
      message: 'Failed to parse bigint',
    },
  );
};

const handleBuffer = (column: ColumnType) => {
  return z.instanceof(Buffer);
};

const handleDate = (column: ColumnType) => {
  return z.preprocess(
    (val) => (typeof val === 'string' ? new Date(val) : val),
    z.date(),
  );
};

const handleTime = (column: ColumnType) => {
  return z.string().refine(
    (val) => {
      return !isNaN(new Date(`2000-01-01 ${val}`).getTime());
    },
    {
      message: 'Invalid time',
    },
  );
};

const interval = z
  .object({
    years: z.number().optional(),
    months: z.number().optional(),
    days: z.number().optional(),
    hours: z.number().optional(),
    seconds: z.number().optional(),
  })
  .strict();

const handleInterval = (column: ColumnType) => {
  return interval;
};

const handleBoolean = (column: ColumnType) => {
  return z.boolean();
};

const handleEnum = (column: ColumnType) => {
  const enumColumn = column as EnumColumn<string, [string, ...string[]]>;
  return z.enum(enumColumn.options);
};

const handleBitString = (column: ColumnType) => {
  return z.string().regex(/[10]/g);
};

const handleUUID = (column: ColumnType) => {
  return z.string().uuid();
};

const handleArray = (column: ColumnType) => {
  const array = column as ArrayColumn<ColumnType>;
  return z.array(schemaToZod(array.data.item));
};

const converters: Record<string, (column: ColumnType) => z.ZodType> = {
  varchar: handleString,
  char: handleString,
  text: handleString,
  smallint: handleNumber,
  integer: handleNumber,
  real: handleNumber,
  smallserial: handleNumber,
  serial: handleNumber,
  money: handleNumber,
  bigint: handleBigInt,
  decimal: handleBigInt,
  'double precision': handleBigInt,
  bigserial: handleBigInt,
  bytea: handleBuffer,
  date: handleDate,
  timestamp: handleDate,
  'timestamp with time zone': handleDate,
  time: handleTime,
  'time with time zone': handleTime,
  interval: handleInterval,
  boolean: handleBoolean,
  enum: handleEnum,
  point: handleString,
  line: handleString,
  lseg: handleString,
  box: handleString,
  path: handleString,
  polygon: handleString,
  circle: handleString,
  cidr: handleString,
  inet: handleString,
  macaddr: handleString,
  macaddr8: handleString,
  bit: handleBitString,
  'bit varying': handleBitString,
  tsvector: handleString,
  tsquery: handleString,
  xml: handleString,
  json: handleString,
  uuid: handleUUID,
  array: handleArray,
};
