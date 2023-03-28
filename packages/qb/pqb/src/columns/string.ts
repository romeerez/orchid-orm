import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import { NumberBaseColumn } from './number';
import { assignMethodsToClass } from './utils';
import {
  stringTypeMethods,
  Code,
  joinTruthy,
  BaseStringData,
  ColumnTypesBase,
  stringDataToCode,
  PrimaryKeyColumn,
  raw,
  RawExpression,
} from 'orchid-core';
import { columnCode } from './code';

export type StringColumn = ColumnType<string, typeof Operators.text>;

export type TextColumnData = BaseStringData;

type TextMethods = typeof textMethods;
const textMethods = stringTypeMethods();

export interface TextBaseColumn
  extends ColumnType<string, typeof Operators.text>,
    TextMethods {}

export abstract class TextBaseColumn extends ColumnType<
  string,
  typeof Operators.text
> {
  declare data: TextColumnData;
  operators = Operators.text;
}

assignMethodsToClass(TextBaseColumn, textMethods);

export abstract class LimitedTextBaseColumn<
  Limit extends number | undefined = undefined,
> extends TextBaseColumn {
  declare data: TextColumnData & { maxChars: Limit };

  constructor(types: ColumnTypesBase, limit?: Limit) {
    super(types);
    this.data.maxChars = limit as Limit;
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.maxChars !== undefined && `(${this.data.maxChars})`,
    );
  }
}

// character varying(n), varchar(n) variable-length with limit
export class VarCharColumn<
  Limit extends number | undefined = undefined,
> extends LimitedTextBaseColumn<Limit> {
  dataType = 'varchar' as const;
  toCode(t: string): Code {
    const { maxChars } = this.data;
    return columnCode(
      this,
      t,
      `varchar(${maxChars ?? ''})${stringDataToCode(this.data)}`,
    );
  }
}

// character(n), char(n) fixed-length, blank padded
export class CharColumn<
  Limit extends number | undefined = undefined,
> extends LimitedTextBaseColumn<Limit> {
  dataType = 'char' as const;
  toCode(t: string): Code {
    const { maxChars } = this.data;
    return columnCode(
      this,
      t,
      `char(${maxChars ?? ''})${stringDataToCode(this.data)}`,
    );
  }
}

const setTextColumnData = (
  column: { data: TextColumnData & { minArg?: number; maxArg?: number } },
  minArg?: number,
  maxArg?: number,
) => {
  if (minArg !== undefined) {
    column.data.min = column.data.minArg = minArg;
    if (maxArg !== undefined) {
      column.data.max = column.data.maxArg = maxArg;
    }
  }
};

const textColumnToCode = (
  column: TextBaseColumn & {
    data: TextColumnData & { minArg?: number; maxArg?: number };
  },
  t: string,
) => {
  const data = { ...column.data };
  let args = '';
  if (data.minArg !== undefined && data.min === data.minArg) {
    args += data.minArg;
    delete data.min;
    if (data.maxArg !== undefined && data.max === data.maxArg) {
      args += `, ${data.maxArg}`;
      delete data.max;
    }
  }
  return columnCode(
    column,
    t,
    `${column.dataType}(${args})${stringDataToCode(data)}`,
  );
};

// text	variable unlimited length
export class TextColumn extends TextBaseColumn {
  dataType = 'text' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };

  constructor(types: ColumnTypesBase, minArg?: number, maxArg?: number) {
    super(types);
    setTextColumnData(this, minArg, maxArg);
  }

  toCode(t: string): Code {
    return textColumnToCode(this, t);
  }
}

// To store binary strings
export class ByteaColumn extends ColumnType<Buffer, typeof Operators.text> {
  dataType = 'bytea' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `bytea()`);
  }
}

// point	16 bytes	Point on a plane	(x,y)
export class PointColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `point()`);
  }
}

// line	32 bytes	Infinite line	{A,B,C}
export class LineColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'line' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `line()`);
  }
}

// lseg	32 bytes	Finite line segment	((x1,y1),(x2,y2))
export class LsegColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'lseg' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `lseg()`);
  }
}

// box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
export class BoxColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'box' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `box()`);
  }
}

// path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
// path	16+16n bytes	Open path	[(x1,y1),...]
export class PathColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'path' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `path()`);
  }
}

// polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
export class PolygonColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'polygon' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `polygon()`);
  }
}

// circle	24 bytes	Circle	<(x,y),r> (center point and radius)
export class CircleColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'circle' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `circle()`);
  }
}

export class MoneyColumn extends NumberBaseColumn {
  dataType = 'money' as const;

  toCode(t: string): Code {
    return columnCode(this, t, `money()`);
  }

  parseFn = Object.assign(
    function (input: unknown) {
      return parseFloat((input as string).replace(/,/g, '').replace(/\$/g, ''));
    },
    {
      hideFromCode: true,
    },
  );
}

// cidr	7 or 19 bytes	IPv4 and IPv6 networks
export class CidrColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'cidr' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `cidr()`);
  }
}

// inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
export class InetColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'inet' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `inet()`);
  }
}

// macaddr	6 bytes	MAC addresses
export class MacAddrColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'macaddr' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `macaddr()`);
  }
}

// macaddr8	8 bytes	MAC addresses (EUI-64 format)
export class MacAddr8Column extends ColumnType<string, typeof Operators.text> {
  dataType = 'macaddr8' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `macaddr8()`);
  }
}

// Bit strings are strings of 1's and 0's.
// They can be used to store or visualize bit masks.
// There are two SQL bit types: bit(n) and bit varying(n), where n is a positive integer.
export class BitColumn<Length extends number> extends ColumnType<
  string,
  typeof Operators.text
> {
  dataType = 'bit' as const;
  operators = Operators.text;
  declare data: ColumnData & { length: Length };

  constructor(types: ColumnTypesBase, length: Length) {
    super(types);
    this.data.length = length;
  }

  toCode(t: string): Code {
    const { length } = this.data;
    return columnCode(this, t, `bit(${length})`);
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
  operators = Operators.text;
  declare data: ColumnData & { length: Length };

  constructor(types: ColumnTypesBase, length?: Length) {
    super(types);

    this.data.length = length as Length;
  }

  toCode(t: string): Code {
    const { length } = this.data;
    return columnCode(this, t, `bitVarying(${length ?? ''})`);
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
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `tsvector()`);
  }
}

// A tsquery value stores lexemes that are to be searched for
export class TsQueryColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'tsquery' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `tsquery()`);
  }
}

const uuidDefault = raw('gen_random_uuid()');

// uuid stores Universally Unique Identifiers (UUID)
export class UUIDColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'uuid' as const;
  operators = Operators.text;

  primaryKey<T extends ColumnType>(this: T): PrimaryKeyColumn<T> {
    const column = super.primaryKey();
    if (!column.data.default) column.data.default = uuidDefault;
    return column as unknown as PrimaryKeyColumn<T>;
  }

  toCode(t: string): Code {
    const { data } = this;
    return columnCode(
      this,
      t,
      `uuid()`,
      typeof data.default === 'object' &&
        (data.default as RawExpression).__raw === uuidDefault.__raw
        ? { ...data, default: undefined }
        : data,
    );
  }
}

// xml data type can be used to store XML data
export class XMLColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'xml' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `xml()`);
  }
}

// citext is a postgres extension
export class CitextColumn extends TextBaseColumn {
  dataType = 'citext' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };

  constructor(types: ColumnTypesBase, minArg?: number, maxArg?: number) {
    super(types);
    setTextColumnData(this, minArg, maxArg);
  }

  toCode(t: string): Code {
    return textColumnToCode(this, t);
  }
}
