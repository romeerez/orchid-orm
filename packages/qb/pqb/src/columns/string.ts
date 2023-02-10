import { ColumnData, ColumnType } from './columnType';
import { Operators } from './operators';
import { joinTruthy, singleQuote } from '../utils';
import { NumberBaseColumn } from './number';
import { assignMethodsToClass } from './utils';
import { stringTypeMethods } from './commonMethods';
import { Code, columnCode } from './code';

export type BaseStringData = ColumnData & {
  min?: number;
  max?: number;
  length?: number;
  email?: boolean;
  url?: boolean;
  uuid?: boolean;
  cuid?: boolean;
  regex?: RegExp;
  startsWith?: string;
  endsWith?: string;
  trim?: boolean;
  isNonEmpty?: true;
};

const stringDataToCode = (data: BaseStringData) => {
  let code = '';

  const { min, isNonEmpty } = data;

  if (min !== undefined && (!isNonEmpty || (isNonEmpty && min !== 1)))
    code += `.min(${min})`;

  if (data.max !== undefined) code += `.max(${data.max})`;
  if (data.length !== undefined) code += `.length(${data.length})`;
  if (data.email !== undefined) code += `.email()`;
  if (data.url !== undefined) code += `.url()`;
  if (data.uuid !== undefined) code += `.uuid()`;
  if (data.cuid !== undefined) code += `.cuid()`;
  if (data.regex) code += `.regex(${data.regex.toString()})`;
  if (data.startsWith !== undefined)
    code += `.startsWith(${singleQuote(data.startsWith)})`;
  if (data.endsWith !== undefined)
    code += `.endsWith(${singleQuote(data.endsWith)})`;
  if (data.cuid !== undefined) code += `.trim()`;

  return code;
};

export type StringColumn = ColumnType<string>;

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
  data = {} as TextColumnData;
  operators = Operators.text;
}

assignMethodsToClass(TextBaseColumn, textMethods);

export abstract class LimitedTextBaseColumn<
  Limit extends number | undefined = undefined,
> extends TextBaseColumn {
  data: TextColumnData & { maxChars: Limit };

  constructor(limit?: Limit) {
    super();

    this.data = { maxChars: limit } as TextColumnData & { maxChars: Limit };
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
      `${t}.varchar(${maxChars ?? ''})${stringDataToCode(this.data)}`,
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
      `${t}.char(${maxChars ?? ''})${stringDataToCode(this.data)}`,
    );
  }
}

// text	variable unlimited length
export class TextColumn extends TextBaseColumn {
  dataType = 'text' as const;
  operators = Operators.text;
  data = {} as TextColumnData & { minArg?: number; maxArg?: number };

  constructor(minArg?: number, maxArg?: number) {
    super();
    if (minArg !== undefined) {
      this.data.min = this.data.minArg = minArg;
      if (maxArg !== undefined) {
        this.data.max = this.data.maxArg = maxArg;
      }
    }
  }

  toCode(t: string): Code {
    const data = { ...this.data };
    let args = '';
    if (data.minArg !== undefined && data.min === data.minArg) {
      args += data.minArg;
      delete data.min;
      if (data.maxArg !== undefined && data.max === data.maxArg) {
        args += `, ${data.maxArg}`;
        delete data.max;
      }
    }
    return columnCode(this, t, `${t}.text(${args})${stringDataToCode(data)}`);
  }
}

// To store binary strings
export class ByteaColumn extends ColumnType<Buffer, typeof Operators.text> {
  dataType = 'bytea' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.bytea()`);
  }
}

// point	16 bytes	Point on a plane	(x,y)
export class PointColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'point' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.point()`);
  }
}

// line	32 bytes	Infinite line	{A,B,C}
export class LineColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'line' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.line()`);
  }
}

// lseg	32 bytes	Finite line segment	((x1,y1),(x2,y2))
export class LsegColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'lseg' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.lseg()`);
  }
}

// box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
export class BoxColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'box' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.box()`);
  }
}

// path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
// path	16+16n bytes	Open path	[(x1,y1),...]
export class PathColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'path' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.path()`);
  }
}

// polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
export class PolygonColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'polygon' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.polygon()`);
  }
}

// circle	24 bytes	Circle	<(x,y),r> (center point and radius)
export class CircleColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'circle' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.circle()`);
  }
}

export class MoneyColumn extends NumberBaseColumn {
  dataType = 'money' as const;

  toCode(t: string): Code {
    return columnCode(this, t, `${t}.money()`);
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
    return columnCode(this, t, `${t}.cidr()`);
  }
}

// inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
export class InetColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'inet' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.inet()`);
  }
}

// macaddr	6 bytes	MAC addresses
export class MacAddrColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'macaddr' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.macaddr()`);
  }
}

// macaddr8	8 bytes	MAC addresses (EUI-64 format)
export class MacAddr8Column extends ColumnType<string, typeof Operators.text> {
  dataType = 'macaddr8' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.macaddr8()`);
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
  data: ColumnData & { length: Length };

  constructor(length: Length) {
    super();

    this.data = { length } as { length: Length };
  }

  toCode(t: string): Code {
    const { length } = this.data;
    return columnCode(this, t, `${t}.bit(${length})`);
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
  data: ColumnData & { length: Length };

  constructor(length?: Length) {
    super();

    this.data = { length } as { length: Length };
  }

  toCode(t: string): Code {
    const { length } = this.data;
    return columnCode(this, t, `${t}.bitVarying(${length ?? ''})`);
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
    return columnCode(this, t, `${t}.tsvector()`);
  }
}

// A tsquery value stores lexemes that are to be searched for
export class TsQueryColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'tsquery' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.tsquery()`);
  }
}

// uuid stores Universally Unique Identifiers (UUID)
export class UUIDColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'uuid' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.uuid()`);
  }
}

// xml data type can be used to store XML data
export class XMLColumn extends ColumnType<string, typeof Operators.text> {
  dataType = 'xml' as const;
  operators = Operators.text;
  toCode(t: string): Code {
    return columnCode(this, t, `${t}.xml()`);
  }
}
