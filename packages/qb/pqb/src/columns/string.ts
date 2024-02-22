import { ColumnData, ColumnType, PickColumnData } from './columnType';
import { NumberBaseColumn } from './number';
import {
  Code,
  joinTruthy,
  StringTypeData,
  stringDataToCode,
  PrimaryKeyColumn,
  TemplateLiteralArgs,
  getDefaultLanguage,
  RawSQLBase,
  StaticSQLArgs,
  ColumnSchemaConfig,
  PickColumnBaseData,
} from 'orchid-core';
import { columnCode } from './code';
import { RawSQL } from '../sql/rawSql';
import { SearchWeight } from '../sql';
import { Operators, OperatorsText } from './operators';

export type TextColumnData = StringTypeData;

export abstract class TextBaseColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  declare data: TextColumnData;
  operators = Operators.text;

  constructor(
    schema: Schema,
    schemaType: ReturnType<
      Schema['stringSchema']
    > = schema.stringSchema() as never,
  ) {
    super(schema, schemaType);
  }
}

export abstract class LimitedTextBaseColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema> {
  declare data: TextColumnData & { maxChars?: number };

  constructor(schema: Schema, limit?: number) {
    super(
      schema,
      (limit ? schema.stringMax(limit) : schema.stringSchema()) as never,
    );
    this.data.maxChars = limit;
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
  Schema extends ColumnSchemaConfig,
> extends LimitedTextBaseColumn<Schema> {
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

export class StringColumn<
  Schema extends ColumnSchemaConfig,
> extends VarCharColumn<Schema> {
  constructor(schema: Schema, limit = 255) {
    super(schema, limit);
  }

  toCode(t: string): Code {
    let max: number | undefined = this.data.maxChars;
    if (max === 255) max = undefined;
    return columnCode(
      this,
      t,
      `string(${max ?? ''})${stringDataToCode(this.data)}`,
    );
  }
}

// character(n), char(n) fixed-length, blank padded
export class CharColumn<
  Schema extends ColumnSchemaConfig,
> extends LimitedTextBaseColumn<Schema> {
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
  column: TextBaseColumn<ColumnSchemaConfig> & {
    data: TextColumnData & { minArg?: number; maxArg?: number };
  },
  t: string,
) => {
  const data = { ...column.data };
  let args = '';
  const hasMax = data.maxArg !== undefined && data.max === data.maxArg;
  if ((data.minArg !== undefined && data.min === data.minArg) || hasMax) {
    if (data.minArg !== 0 || (hasMax && data.max !== Infinity)) {
      args += data.minArg;
    }
    delete data.min;
    if (hasMax) {
      if (data.maxArg !== Infinity) {
        args += `, ${data.maxArg}`;
      }
      delete data.max;
    }
  }
  return columnCode(
    column,
    t,
    `${column.dataType}(${args})${stringDataToCode(data)}`,
  );
};

const minMaxToSchema = <Schema extends ColumnSchemaConfig>(
  schema: Schema,
  min?: number,
  max?: number,
) =>
  min
    ? max
      ? schema.stringMinMax(min, max)
      : schema.stringMin(min)
    : schema.stringSchema();

// text	variable unlimited length
export class TextColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema> {
  dataType = 'text' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };

  constructor(schema: Schema, min?: number, max?: number) {
    super(schema, minMaxToSchema(schema, min, max) as never);
    setTextColumnData(this, min, max);
  }

  toCode(t: string): Code {
    return textColumnToCode(this, t);
  }
}

// To store binary strings
export class ByteaColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  Buffer,
  ReturnType<Schema['buffer']>,
  OperatorsText
> {
  dataType = 'bytea' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.buffer() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `bytea()`);
  }
}

// point	16 bytes	Point on a plane	(x,y)
export class PointColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'point' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `point()`);
  }
}

// line	32 bytes	Infinite line	{A,B,C}
export class LineColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'line' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `line()`);
  }
}

// lseg	32 bytes	Finite line segment	((x1,y1),(x2,y2))
export class LsegColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'lseg' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `lseg()`);
  }
}

// box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
export class BoxColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'box' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `box()`);
  }
}

// path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
// path	16+16n bytes	Open path	[(x1,y1),...]
export class PathColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'path' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `path()`);
  }
}

// polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
export class PolygonColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'polygon' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `polygon()`);
  }
}

// circle	24 bytes	Circle	<(x,y),r> (center point and radius)
export class CircleColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'circle' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `circle()`);
  }
}

export class MoneyColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberBaseColumn<Schema, ReturnType<Schema['stringSchema']>> {
  dataType = 'money' as const;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

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
export class CidrColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'cidr' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `cidr()`);
  }
}

// inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
export class InetColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'inet' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `inet()`);
  }
}

// macaddr	6 bytes	MAC addresses
export class MacAddrColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'macaddr' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `macaddr()`);
  }
}

// macaddr8	8 bytes	MAC addresses (EUI-64 format)
export class MacAddr8Column<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'macaddr8' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `macaddr8()`);
  }
}

// Bit strings are strings of 1's and 0's.
// They can be used to store or visualize bit masks.
// There are two SQL bit types: bit(n) and bit varying(n), where n is a positive integer.
export class BitColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['bit']>,
  OperatorsText
> {
  dataType = 'bit' as const;
  operators = Operators.text;
  declare data: ColumnData & { length: number };

  constructor(schema: Schema, length: number) {
    super(schema, schema.bit(length) as ReturnType<Schema['bit']>);
    this.data.length = length;
  }

  toCode(t: string): Code {
    const { length } = this.data;
    return columnCode(this, t, `bit(${length})`);
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.length !== undefined && `(${this.data.length})`,
    );
  }
}

export class BitVaryingColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<Schema, string, ReturnType<Schema['bit']>, OperatorsText> {
  dataType = 'bit varying' as const;
  operators = Operators.text;
  declare data: ColumnData & { length?: number };

  constructor(schema: Schema, length?: number) {
    super(schema, schema.bit(length) as ReturnType<Schema['bit']>);
    this.data.length = length;
  }

  toCode(t: string): Code {
    const { length } = this.data;
    return columnCode(this, t, `bitVarying(${length ?? ''})`);
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.length !== undefined && `(${this.data.length})`,
    );
  }
}

type TsVectorGeneratedColumns = string[] | Record<string, SearchWeight>;

// A tsvector value is a sorted list of distinct lexemes
export class TsVectorColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'tsvector' as const;
  operators = Operators.text;

  constructor(schema: Schema, public defaultLanguage = getDefaultLanguage()) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `tsvector()`);
  }

  /**
   * For `tsvector` column type, it can also accept language (optional) and columns:
   *
   * ```ts
   * import { change } from '../dbScript';
   *
   * change(async (db) => {
   *   await db.createTable('post', (t) => ({
   *     id: t.id(),
   *     title: t.text(),
   *     body: t.text(),
   *     // join title and body into a single ts_vector
   *     generatedTsVector: t.tsvector().generated(['title', 'body']).searchIndex(),
   *     // with language:
   *     spanishTsVector: t
   *       .tsvector()
   *       .generated('spanish', ['title', 'body'])
   *       .searchIndex(),
   *   }));
   * });
   * ```
   *
   * @param args
   */
  generated<T extends PickColumnData>(
    this: T,
    ...args:
      | StaticSQLArgs
      | [language: string, columns: TsVectorGeneratedColumns]
      | [columns: TsVectorGeneratedColumns]
  ): T {
    const first = args[0];
    if (typeof first === 'string' || !('raw' in first)) {
      const target = typeof first === 'string' ? (args[1] as string[]) : first;

      let sql;
      if (Array.isArray(target)) {
        const columns =
          target.length === 1
            ? `"${target[0]}"`
            : target
                .map((column) => `coalesce("${column}", '')`)
                .join(` || ' ' || `);

        sql = `to_tsvector('${
          typeof first === 'string'
            ? first
            : (this as unknown as TsVectorColumn<ColumnSchemaConfig>)
                .defaultLanguage
        }', ${columns})`;
      } else {
        for (const key in target) {
          sql =
            (sql ? sql + ' || ' : '') +
            `setweight(to_tsvector(coalesce("${key}", '')), '${target[key]}')`;
        }
      }

      const arr = [sql] as string[] & { raw: string[] };
      arr.raw = arr;
      args = [arr] as unknown as TemplateLiteralArgs;
    }

    return super.generated(...(args as TemplateLiteralArgs)) as unknown as T;
  }
}

// A tsquery value stores lexemes that are to be searched for
export class TsQueryColumn<
  Schema extends ColumnSchemaConfig,
> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'tsquery' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `tsquery()`);
  }
}

const uuidDefaultSQL = 'gen_random_uuid()';
const uuidDefault = new RawSQL(uuidDefaultSQL);

// uuid stores Universally Unique Identifiers (UUID)
export class UUIDColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['uuid']>,
  OperatorsText
> {
  dataType = 'uuid' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.uuid() as never);
  }

  primaryKey<T extends PickColumnBaseData>(
    this: T,
  ): // using & bc otherwise the return type doesn't match `primaryKey` in ColumnType and TS complains
  PrimaryKeyColumn<T> & { data: { default: RawSQLBase } } {
    const column = super.primaryKey();
    if (!column.data.default) column.data.default = uuidDefault;
    return column as unknown as PrimaryKeyColumn<T> & {
      data: { default: RawSQLBase };
    };
  }

  toCode(t: string): Code {
    const { data } = this;
    return columnCode(
      this,
      t,
      `uuid()`,
      // don't output the default default
      data.default instanceof RawSQLBase && data.default._sql === uuidDefaultSQL
        ? { ...data, default: undefined }
        : data,
    );
  }
}

// xml data type can be used to store XML data
export class XMLColumn<Schema extends ColumnSchemaConfig> extends ColumnType<
  Schema,
  string,
  ReturnType<Schema['stringSchema']>,
  OperatorsText
> {
  dataType = 'xml' as const;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string): Code {
    return columnCode(this, t, `xml()`);
  }
}

// citext is a postgres extension
export class CitextColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema> {
  dataType = 'citext' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };

  constructor(schema: Schema, min?: number, max?: number) {
    super(schema, minMaxToSchema(schema, min, max) as never);
    setTextColumnData(this, min, max);
  }

  toCode(t: string): Code {
    return textColumnToCode(this, t);
  }
}
