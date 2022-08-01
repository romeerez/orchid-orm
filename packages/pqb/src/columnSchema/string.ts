import { ColumnType } from './base';
import { Operators } from '../operators';
import { joinTruthy } from '../utils';
import { NumberBaseColumn } from './number';
import { assignMethodsToClass } from './utils';
import { stringTypeMethods } from './commonMethods';

export interface BaseStringData {
  min?: number;
  max?: number;
  length?: number;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  regex?: RegExp;
  trim?: boolean;
}

export type TextColumnData = BaseStringData;

type TextMethods = typeof textMethods;
const textMethods = stringTypeMethods<ColumnType<string>>();

export interface TextBaseColumn
  extends ColumnType<string, typeof Operators.text>,
    TextMethods {}

export abstract class TextBaseColumn extends ColumnType<
  string,
  typeof Operators.text
> {
  data = {} as TextColumnData;
}

assignMethodsToClass(TextBaseColumn, textMethods);

export abstract class LimitedTextBaseColumn<
  Limit extends number | undefined = undefined,
> extends TextBaseColumn {
  data: TextColumnData & { max: Limit };

  constructor(limit?: Limit) {
    super();

    this.data = { max: limit } as TextColumnData & { max: Limit };
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.max !== undefined && `(${this.data.max})`,
    );
  }
}

// character varying(n), varchar(n)	variable-length with limit
export class VarCharColumn<
  Limit extends number | undefined = undefined,
> extends LimitedTextBaseColumn<Limit> {
  dataType = 'varchar' as const;
}

// character(n), char(n)	fixed-length, blank padded
export class CharColumn<
  Limit extends number | undefined = undefined,
> extends LimitedTextBaseColumn<Limit> {
  dataType = 'char' as const;
}

// text	variable unlimited length
export class TextColumn extends ColumnType<string> {
  dataType = 'text' as const;
}

// To store binary strings
export class ByteaColumn extends NumberBaseColumn<string> {
  dataType = 'bytea' as const;
}

// point	16 bytes	Point on a plane	(x,y)
export class PointColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

// line	32 bytes	Infinite line	{A,B,C}
export class LineColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

// lseg	32 bytes	Finite line segment	((x1,y1),(x2,y2))
export class LsegColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

// box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
export class BoxColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

// path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
// path	16+16n bytes	Open path	[(x1,y1),...]
export class PathColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

// polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
export class PolygonColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

// circle	24 bytes	Circle	<(x,y),r> (center point and radius)
export class CircleColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
}

export class MoneyColumn extends NumberBaseColumn<string> {
  dataType = 'money' as const;
}

// cidr	7 or 19 bytes	IPv4 and IPv6 networks
export class CidrColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'cidr' as const;
}

// inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
export class InetColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'inet' as const;
}

// macaddr	6 bytes	MAC addresses
export class MacAddrColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'macaddr' as const;
}

// macaddr8	8 bytes	MAC addresses (EUI-64 format)
export class MacAddr8Column extends ColumnType<string, typeof Operators.text> {
  dataType = 'macaddr8' as const;
}

// Bit strings are strings of 1's and 0's.
// They can be used to store or visualize bit masks.
// There are two SQL bit types: bit(n) and bit varying(n), where n is a positive integer.
export class BitColumn<
  Length extends number | undefined = undefined,
> extends ColumnType<string, typeof Operators.text> {
  dataType = 'bit' as const;
  data: { length: Length };

  constructor(length?: Length) {
    super();

    this.data = { length } as { length: Length };
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.length && `(${this.data.length})`,
    );
  }
}

export class BitVaryingColumn<
  Length extends number | undefined = undefined,
> extends ColumnType<string, typeof Operators.text> {
  dataType = 'bit varying' as const;
  data: { length: Length };

  constructor(length?: Length) {
    super();

    this.data = { length } as { length: Length };
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.length && `(${this.data.length})`,
    );
  }
}

// A tsvector value is a sorted list of distinct lexemes
export class TsVectorColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'tsvector' as const;
}

// A tsquery value stores lexemes that are to be searched for
export class TsQueryColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'tsquery' as const;
}

// A tsquery value stores lexemes that are to be searched for
export class UUIDColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'uuid' as const;
}

export class XMLColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'uuid' as const;
}
