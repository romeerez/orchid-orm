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
  ColumnNameOfTable,
  ColumnSchemaConfig,
  EmptyObject,
  emptyObject,
  ForeignKeyTable,
  makeTimestampsHelpers,
  MaybeArray,
  QueryColumn,
  QueryColumnsInit,
  RawSQLBase,
  RecordUnknown,
  setCurrentColumnName,
  setDefaultLanguage,
  setDefaultNowFn,
  TemplateLiteralArgs,
  TimestampHelpers,
  toArray,
} from 'orchid-core';
import {
  ColumnType,
  DropMode,
  ForeignKeyOptions,
  IndexColumnOptions,
  IndexOptions,
} from './columnType';
import { makeRegexToFindInSql } from '../common/utils';
import { CustomTypeColumn, DomainColumn } from './customType';
import { RawSQL } from '../sql/rawSql';

export interface TableData {
  primaryKey?: TableData.PrimaryKey;
  indexes?: TableData.Index[];
  constraints?: TableData.Constraint[];
}

export namespace TableData {
  export interface PrimaryKey {
    columns: string[];
    options?: { name?: string };
  }

  export interface Index {
    columns: IndexColumnOptions[];
    options: IndexOptions;
  }

  export interface Constraint {
    name?: string;
    check?: Check;
    identity?: Identity;
    references?: References;
    dropMode?: DropMode;
  }

  export type Check = RawSQLBase;

  export interface References {
    columns: string[];
    fnOrTable: (() => ForeignKeyTable) | string;
    foreignColumns: string[];
    options?: ForeignKeyOptions;
  }

  export interface Identity extends SequenceBaseOptions {
    always?: boolean;
  }

  interface SequenceBaseOptions {
    incrementBy?: number;
    startWith?: number;
    min?: number;
    max?: number;
    cache?: number;
    cycle?: boolean;
  }

  export interface SequenceOptions extends SequenceBaseOptions {
    dataType?: 'smallint' | 'integer' | 'bigint';
    ownedBy?: string;
  }
}

export const newTableData = (): TableData => ({});

let tableData: TableData = newTableData();

export const getTableData = () => tableData;

export const resetTableData = (data: TableData = newTableData()) => {
  tableData = data;
};

export const getColumnTypes = <ColumnTypes, Shape extends QueryColumnsInit>(
  types: ColumnTypes,
  fn: (t: ColumnTypes) => Shape,
  nowSQL: string | undefined,
  language: string | undefined,
  data: TableData = newTableData(),
) => {
  if (nowSQL) setDefaultNowFn(nowSQL);
  if (language) setDefaultLanguage(language);

  resetTableData(data);
  return fn(types);
};

export interface DefaultColumnTypes<SchemaConfig extends ColumnSchemaConfig>
  extends TimestampHelpers {
  schema: SchemaConfig;
  enum: SchemaConfig['enum'];
  array: SchemaConfig['array'];

  name<T>(this: T, name: string): T;

  sql<
    T,
    Args extends
      | [sql: TemplateStringsArray, ...values: unknown[]]
      | [sql: string]
      | [values: RecordUnknown, sql?: string],
  >(
    this: T,
    ...args: Args
  ): Args extends [RecordUnknown]
    ? (...sql: TemplateLiteralArgs) => RawSQLBase<QueryColumn, T>
    : RawSQLBase<QueryColumn, T>;

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

  primaryKey(columns: string[], options?: { name?: string }): EmptyObject;

  index(
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ): EmptyObject;

  unique(
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ): EmptyObject;

  /**
   * See {@link ColumnType.searchIndex}
   */
  searchIndex(
    columns: MaybeArray<string | IndexColumnOptions>,
    options?: IndexOptions,
  ): EmptyObject;

  constraint<
    Table extends (() => ForeignKeyTable) | string,
    Columns extends Table extends () => ForeignKeyTable
      ? [
          ColumnNameOfTable<ReturnType<Table>>,
          ...ColumnNameOfTable<ReturnType<Table>>[],
        ]
      : [string, ...string[]],
  >({
    name,
    references,
    check,
    dropMode,
  }: {
    name?: string;
    references?: [
      columns: string[],
      fnOrTable: Table,
      foreignColumns: Columns,
      options?: ForeignKeyOptions,
    ];
    check?: RawSQLBase;
    dropMode?: DropMode;
  }): EmptyObject;

  foreignKey<
    Table extends (() => ForeignKeyTable) | string,
    Columns extends Table extends () => ForeignKeyTable
      ? [
          ColumnNameOfTable<ReturnType<Table>>,
          ...ColumnNameOfTable<ReturnType<Table>>[],
        ]
      : [string, ...string[]],
  >(
    columns: string[],
    fnOrTable: Table,
    foreignColumns: Columns,
    options?: ForeignKeyOptions & { name?: string; dropMode?: DropMode },
  ): EmptyObject;

  check(check: RawSQLBase): EmptyObject;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sql(...args: any[]): any {
      const arg = args[0];
      if (Array.isArray(arg)) {
        return new RawSQL(args as TemplateLiteralArgs);
      }

      if (typeof args[0] === 'string') {
        return new RawSQL(args[0]);
      }

      if (args[1] !== undefined) {
        return new RawSQL(args[1], arg);
      }

      return (...args: TemplateLiteralArgs) =>
        new RawSQL(args, arg as RecordUnknown);
    },

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

    primaryKey(columns, options) {
      tableData.primaryKey = { columns, options };
      return emptyObject;
    },

    index(columns, options = {}) {
      const index = {
        columns: toArray(columns).map((column) =>
          typeof column === 'string' ? { column } : column,
        ),
        options,
      };

      (tableData.indexes ??= []).push(index);
      return emptyObject;
    },

    unique(columns, options) {
      return this.index(columns, { ...options, unique: true });
    },

    /**
     * See {@link ColumnType.searchIndex}
     */
    searchIndex(columns, options) {
      return this.index(columns, { ...options, tsVector: true });
    },

    constraint({ name, references, check, dropMode }) {
      (tableData.constraints ??= []).push({
        name,
        references: references
          ? {
              columns: references[0],
              fnOrTable: references[1],
              foreignColumns: references[2],
              options: references[3],
            }
          : undefined,
        check,
        dropMode,
      });
      return emptyObject;
    },

    foreignKey(columns, fnOrTable, foreignColumns, options) {
      (tableData.constraints ??= []).push({
        name: options?.name,
        references: {
          columns,
          fnOrTable,
          foreignColumns,
          options,
        },
        dropMode: options?.dropMode,
      });
      return emptyObject;
    },

    check(check) {
      (tableData.constraints ??= []).push({
        check,
      });
      return emptyObject;
    },

    ...makeTimestampsHelpers(makeRegexToFindInSql),
  };
};

RawSQL.prototype.columnTypes = makeColumnTypes;
