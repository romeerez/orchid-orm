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
import { SearchWeightRecord } from '../sql';
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

  constructor(schema: Schema, limit: number) {
    super(schema, schema.stringMax(limit) as never);
    this.data.maxChars = limit;
  }

  toSQL() {
    return joinTruthy(this.dataType, `(${this.data.maxChars})`);
  }
}

// character varying(n), varchar(n) variable-length with limit
export class VarCharColumn<
  Schema extends ColumnSchemaConfig,
> extends LimitedTextBaseColumn<Schema> {
  dataType = 'varchar' as const;
  toCode(t: string, m?: boolean): Code {
    const { maxChars } = this.data;
    return columnCode(
      this,
      t,
      `varchar(${maxChars ?? ''})${stringDataToCode(this.data, m)}`,
      m,
    );
  }
}

export class StringColumn<
  Schema extends ColumnSchemaConfig,
> extends VarCharColumn<Schema> {
  constructor(schema: Schema, limit = 255) {
    super(schema, limit);
  }

  toCode(t: string, m?: boolean): Code {
    let max: number | undefined = this.data.maxChars;
    if (max === 255) max = undefined;
    return columnCode(
      this,
      t,
      `string(${max ?? ''})${stringDataToCode(this.data, m)}`,
      m,
    );
  }
}

const textColumnToCode = (
  column: TextBaseColumn<ColumnSchemaConfig> & {
    data: TextColumnData & { minArg?: number; maxArg?: number };
  },
  t: string,
  m?: boolean,
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
    `${column.dataType}(${args})${stringDataToCode(data, m)}`,
    m,
  );
};

// text	variable unlimited length
export class TextColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema> {
  dataType = 'text' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string, m?: boolean): Code {
    return textColumnToCode(this, t, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `bytea()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `point()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `line()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `lseg()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `box()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `path()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `polygon()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `circle()`, m);
  }
}

export class MoneyColumn<
  Schema extends ColumnSchemaConfig,
> extends NumberBaseColumn<Schema, ReturnType<Schema['stringSchema']>> {
  dataType = 'money' as const;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `money()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `cidr()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `inet()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `macaddr()`, m);
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `macaddr8()`, m);
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

  toCode(t: string, m?: boolean): Code {
    const { length } = this.data;
    return columnCode(this, t, `bit(${length})`, m);
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
  dataType = 'varbit' as const;
  operators = Operators.text;
  declare data: ColumnData & { length?: number };

  constructor(schema: Schema, length?: number) {
    super(schema, schema.bit(length) as ReturnType<Schema['bit']>);
    this.data.length = length;
    this.data.alias = 'bitVarying';
  }

  toCode(t: string, m?: boolean): Code {
    const { length } = this.data;
    return columnCode(this, t, `bitVarying(${length ?? ''})`, m);
  }

  toSQL() {
    return joinTruthy(
      this.dataType,
      this.data.length !== undefined && `(${this.data.length})`,
    );
  }
}

type TsVectorGeneratedColumns = string[] | SearchWeightRecord;

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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `tsvector()`, m);
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

      const language =
        typeof first === 'string'
          ? first
          : (this as unknown as TsVectorColumn<ColumnSchemaConfig>)
              .defaultLanguage;

      let sql;
      if (Array.isArray(target)) {
        const columns =
          target.length === 1
            ? `"${target[0]}"`
            : target
                .map((column) => `coalesce("${column}", '')`)
                .join(` || ' ' || `);

        sql = `to_tsvector('${language}', ${columns})`;
      } else {
        for (const key in target) {
          sql =
            (sql ? sql + ' || ' : '(') +
            `setweight(to_tsvector('${language}', coalesce("${key}", '')), '${target[key]}')`;
        }
        if (sql) sql += ')';
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `tsquery()`, m);
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

  /**
   * see {@link ColumnType.primaryKey}
   */
  primaryKey<T extends PickColumnBaseData, Name extends string>(
    this: T,
    name?: Name,
  ): // using & bc otherwise the return type doesn't match `primaryKey` in ColumnType and TS complains
  PrimaryKeyColumn<T, Name> & { data: { default: RawSQLBase } } {
    const column = super.primaryKey(name);
    if (!column.data.default) column.data.default = uuidDefault;
    return column as never;
  }

  toCode(t: string, m?: boolean): Code {
    const { data } = this;
    return columnCode(
      this,
      t,
      `uuid()`,
      m,
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

  toCode(t: string, m?: boolean): Code {
    return columnCode(this, t, `xml()`, m);
  }
}

// citext is a postgres extension
export class CitextColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema> {
  dataType = 'citext' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(t: string, m?: boolean): Code {
    return textColumnToCode(this, t, m);
  }
}
