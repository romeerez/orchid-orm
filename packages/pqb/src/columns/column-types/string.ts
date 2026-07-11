import { Column, getDefaultLanguage, setColumnData } from '../column';
import { NumberColumnData } from './number';
import { Code, ColumnToCodeCtx, stringDataToCode } from '../code';
import { columnCode } from '../code';
import { RawSql } from '../../query/expressions/raw-sql';
import { Operators, OperatorsOrdinalText, OperatorsText } from '../operators';
import { setColumnDefaultParse } from '../column.utils';
import {
  DefaultSchemaConfig,
  internalSchemaConfig,
} from '../default-schema-config';
import { StringData } from '../column-data-types';
import { ColumnSchemaConfig } from '../column-schema';
import {
  joinTruthy,
  quoteObjectKey,
  RecordString,
  toSnakeCase,
} from '../../utils';
import { StaticSQLArgs } from '../../query/expressions/expression';
import { SearchWeightRecord } from '../../query';

export type TextColumnData = StringData;

export abstract class TextBaseColumn<
  Schema extends ColumnSchemaConfig,
  Ops = OperatorsText,
> extends Column {
  declare __schema: Schema;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare data: TextColumnData;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text as Ops;

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
> extends TextBaseColumn<Schema, OperatorsOrdinalText> {
  declare data: TextColumnData & { maxChars?: number };
  operators = Operators.ordinalText;

  constructor(schema: Schema, limit?: number) {
    super(
      schema,
      (limit !== undefined
        ? schema.stringMax(limit)
        : schema.stringSchema()) as never,
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
  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const { maxChars } = this.data;
    return columnCode(
      this,
      ctx,
      key,
      `varchar(${maxChars ?? ''})${stringDataToCode(this.data, ctx.migration)}`,
    );
  }
}

export class StringColumn<
  Schema extends ColumnSchemaConfig,
> extends VarCharColumn<Schema> {
  constructor(schema: Schema, limit = 255) {
    super(schema, limit);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    let max: number | undefined = this.data.maxChars;
    if (max === 255) max = undefined;
    return columnCode(
      this,
      ctx,
      key,
      `string(${max ?? ''})${stringDataToCode(this.data, ctx.migration)}`,
    );
  }
}

const textColumnToCode = (
  column: TextBaseColumn<ColumnSchemaConfig> & {
    data: TextColumnData & { minArg?: number; maxArg?: number };
  },
  ctx: ColumnToCodeCtx,
  key: string,
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
    ctx,
    key,
    `${column.dataType}(${args})${stringDataToCode(data, ctx.migration)}`,
  );
};

// text	variable unlimited length
export class TextColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema, OperatorsOrdinalText> {
  dataType = 'text' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  private static _instance: TextColumn<DefaultSchemaConfig> | undefined;
  static get instance() {
    return (this._instance ??= new TextColumn(internalSchemaConfig));
  }

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return textColumnToCode(this, ctx, key);
  }
}

const byteaParse = (val: unknown) =>
  typeof val === 'string' ? Buffer.from(val.slice(2), 'hex') : val;

// To store binary strings
export class ByteaColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'bytea' as const;
  operators = Operators.ordinalText;
  declare __type: string;
  declare __inputType: Buffer;
  declare inputSchema: ReturnType<Schema['buffer']>;
  declare __outputType: Buffer;
  declare outputSchema: ReturnType<Schema['buffer']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;

  constructor(schema: Schema) {
    super(schema, schema.buffer() as never);
    setColumnDefaultParse(this, byteaParse);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `bytea()`);
  }
}

// point	16 bytes	Point on a plane	(x,y)
export class PointColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'point' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `point()`);
  }
}

// line	32 bytes	Infinite line	{A,B,C}
export class LineColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'line' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `line()`);
  }
}

// lseg	32 bytes	Finite line segment	((x1,y1),(x2,y2))
export class LsegColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'lseg' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `lseg()`);
  }
}

// box	32 bytes	Rectangular box	((x1,y1),(x2,y2))
export class BoxColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'box' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `box()`);
  }
}

// path	16+16n bytes	Closed path (similar to polygon)	((x1,y1),...)
// path	16+16n bytes	Open path	[(x1,y1),...)
export class PathColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'path' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `path()`);
  }
}

// polygon	40+16n bytes	Polygon (similar to closed path)	((x1,y1),...)
export class PolygonColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'polygon' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `polygon()`);
  }
}

// circle	24 bytes	Circle	<(x,y),r> (center point and radius)
export class CircleColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'circle' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `circle()`);
  }
}

export class MoneyColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'money' as const;
  declare __type: string;
  declare data: NumberColumnData;
  declare __inputType: string | number;
  declare inputSchema: ReturnType<Schema['number']>;
  declare __outputType: number;
  declare outputSchema: ReturnType<Schema['number']>;
  declare __queryType: string | number;
  declare querySchema: ReturnType<Schema['number']>;
  operators = Operators.number;

  constructor(schema: Schema) {
    super(schema, schema.number() as never);
    setColumnDefaultParse(this, moneyParse);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `money()`);
  }
}

const moneyParse = Object.assign(
  function (input: unknown) {
    return input === null
      ? input
      : parseFloat((input as string).replace(/,/g, '').replace(/\$/g, ''));
  },
  {
    hideFromCode: true,
  },
);

// cidr	7 or 19 bytes	IPv4 and IPv6 networks
export class CidrColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'cidr' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `cidr()`);
  }
}

// inet	7 or 19 bytes	IPv4 and IPv6 hosts and networks
export class InetColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'inet' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `inet()`);
  }
}

// macaddr	6 bytes	MAC addresses
export class MacAddrColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'macaddr' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `macaddr()`);
  }
}

// macaddr8	8 bytes	MAC addresses (EUI-64 format)
export class MacAddr8Column<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'macaddr8' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `macaddr8()`);
  }
}

// Bit strings are strings of 1's and 0's.
// They can be used to store or visualize bit masks.
// There are two SQL bit types: bit(n) and bit varying(n), where n is a positive integer.
export class BitColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'bit' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['bit']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['bit']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['bit']>;
  operators = Operators.ordinalText;
  declare data: Column.Data & { length: number };

  constructor(schema: Schema, length: number) {
    super(schema, schema.bit(length) as ReturnType<Schema['bit']>);
    this.data.length = length;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const { length } = this.data;
    return columnCode(this, ctx, key, `bit(${length})`);
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
> extends Column {
  declare __schema: Schema;
  dataType = 'varbit' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['bit']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['bit']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['bit']>;
  operators = Operators.ordinalText;
  declare data: Column.Data & { length?: number };

  constructor(schema: Schema, length?: number) {
    super(schema, schema.bit(length) as ReturnType<Schema['bit']>);
    this.data.length = length;
    this.data.alias = 'bitVarying';
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    const { length } = this.data;
    return columnCode(this, ctx, key, `bitVarying(${length ?? ''})`);
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
export class TsVectorColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'tsvector' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  constructor(
    schema: Schema,
    public defaultLanguage = getDefaultLanguage(),
  ) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `tsvector()`);
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
  generated<T extends Column.Pick.Data>(
    this: T,
    ...args:
      | StaticSQLArgs
      | [language: string, columns: TsVectorGeneratedColumns]
      | [columns: TsVectorGeneratedColumns]
  ): Column.Modifiers.Generated<T> {
    const arg = args[0];
    // early return on StaticSQLArgs case
    if (typeof arg === 'object' && 'raw' in arg) {
      return super.generated(...(args as StaticSQLArgs)) as never;
    }

    const toSQL: Column.Data.Generated['toSQL'] = (ctx) => {
      const first = args[0];
      const target = typeof first === 'string' ? (args[1] as string[]) : first;

      const language =
        typeof first === 'string'
          ? first
          : (this as unknown as TsVectorColumn<ColumnSchemaConfig>)
              .defaultLanguage;

      const { snakeCase } = ctx;

      let sql;
      if (Array.isArray(target)) {
        const columns =
          target.length === 1
            ? `"${snakeCase ? toSnakeCase(target[0]) : target[0]}"`
            : target
                .map(
                  (column) =>
                    `coalesce("${
                      snakeCase ? toSnakeCase(column) : column
                    }", '')`,
                )
                .join(` || ' ' || `);

        sql = `to_tsvector('${language}', ${columns})`;
      } else {
        for (const key in target) {
          sql =
            (sql ? sql + ' || ' : '(') +
            `setweight(to_tsvector('${language}', coalesce("${
              snakeCase ? toSnakeCase(key) : key
            }", '')), '${(target as RecordString)[key]}')`;
        }
        if (sql) {
          sql += ')';
        } else {
          throw new Error('Empty target in the text search generated column');
        }
      }

      return sql;
    };

    const toCode = (): string => {
      let code = '.generated(';

      const first = args[0];
      let target;
      if (typeof first === 'string') {
        code += `'${first}', `;
        target = args[1] as string[];
      } else {
        target = args[0];
      }

      if (Array.isArray(target)) {
        code += `[${target.map((x) => `'${x}'`).join(', ')}]`;
      } else {
        const pairs: string[] = [];
        for (const key in target as RecordString) {
          pairs.push(
            `${quoteObjectKey(key, false)}: '${(target as RecordString)[key]}'`,
          );
        }
        code += `{ ${pairs.join(', ')} }`;
      }

      return code + ')';
    };

    const column = setColumnData(this, 'generated', {
      toSQL,
      toCode,
    });
    column.data.readOnly = true;
    return column as never;
  }
}

// A tsquery value stores lexemes that are to be searched for
export class TsQueryColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'tsquery' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `tsquery()`);
  }
}

const uuidDefaultSQL = 'gen_random_uuid()';
const uuidDefault = new RawSql(uuidDefaultSQL);

// uuid stores Universally Unique Identifiers (UUID)
export class UUIDColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'uuid' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['uuid']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['uuid']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['uuid']>;
  operators = Operators.ordinalText;

  constructor(schema: Schema) {
    super(schema, schema.uuid() as never);
    this.data.defaultDefault = uuidDefault;
  }

  /**
   * see {@link Column.primaryKey}
   */
  primaryKey<T extends Column.Pick.Data, Name extends string>(
    this: T,
    name?: Name,
  ): // using & bc otherwise the return type doesn't match `primaryKey` in ColumnType and TS complains
  T & {
    data: { primaryKey: Name; default: true };
  } {
    const column = super.primaryKey(name);
    if (!column.data.default) column.data.default = uuidDefault;
    return column as never;
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `uuid()`);
  }
}

// xml data type can be used to store XML data
export class XMLColumn<Schema extends ColumnSchemaConfig> extends Column {
  declare __schema: Schema;
  dataType = 'xml' as const;
  declare __type: string;
  declare __inputType: string;
  declare inputSchema: ReturnType<Schema['stringSchema']>;
  declare __outputType: string;
  declare outputSchema: ReturnType<Schema['stringSchema']>;
  declare __queryType: string;
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.text;

  private static _instance: XMLColumn<DefaultSchemaConfig> | undefined;
  static get instance() {
    return (this._instance ??= new XMLColumn(internalSchemaConfig));
  }

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return columnCode(this, ctx, key, `xml()`);
  }
}

// citext is a postgres extension
export class CitextColumn<
  Schema extends ColumnSchemaConfig,
> extends TextBaseColumn<Schema, OperatorsOrdinalText> {
  declare __schema: Schema;
  dataType = 'citext' as const;
  declare data: TextColumnData & { minArg?: number; maxArg?: number };
  declare querySchema: ReturnType<Schema['stringSchema']>;
  operators = Operators.ordinalText;

  constructor(schema: Schema) {
    super(schema, schema.stringSchema() as never);
    this.data.extension = 'citext';
  }

  toCode(ctx: ColumnToCodeCtx, key: string): Code {
    return textColumnToCode(this, ctx, key);
  }
}
