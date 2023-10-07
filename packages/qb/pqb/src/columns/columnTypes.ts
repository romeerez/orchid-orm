import {
  BigIntColumn,
  BigSerialColumn,
  DecimalColumn,
  DoublePrecisionColumn,
  IdentityColumn,
  IntegerColumn,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
} from './number';
import {
  BitColumn,
  BitVaryingColumn,
  BoxColumn,
  ByteaColumn,
  CharColumn,
  CidrColumn,
  CircleColumn,
  CitextColumn,
  InetColumn,
  LineColumn,
  LsegColumn,
  MacAddr8Column,
  MacAddrColumn,
  MoneyColumn,
  PathColumn,
  PointColumn,
  PolygonColumn,
  TextColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  VarCharColumn,
  XMLColumn,
} from './string';
import {
  DateColumn,
  IntervalColumn,
  TimeColumn,
  TimestampColumn,
  TimestampTZColumn,
} from './dateTime';
import { BooleanColumn } from './boolean';
import { EnumColumn } from './enum';
import { JSONColumn, JSONTextColumn } from './json';
import {
  ColumnNameOfTable,
  EmptyObject,
  emptyObject,
  ForeignKeyTable,
  makeTimestampsHelpers,
  MaybeArray,
  name,
  setDefaultLanguage,
  setDefaultNowFn,
  TemplateLiteralArgs,
  toArray,
  RawSQLBase,
  JSONType,
  JSONTypes,
  JSONUnknown,
  ColumnTypesBase,
  TimestampHelpers,
  ColumnsShapeBase,
} from 'orchid-core';
import { ArrayColumn } from './array';
import {
  ColumnType,
  DropMode,
  IndexColumnOptions,
  IndexOptions,
  ForeignKeyOptions,
} from './columnType';
import { makeRegexToFindInSql } from '../common/utils';
import { CustomTypeColumn, DomainColumn } from './customType';
import { RawSQL } from '../sql/rawSql';

export type TableData = {
  primaryKey?: TableData.PrimaryKey;
  indexes?: TableData.Index[];
  constraints?: TableData.Constraint[];
};

export namespace TableData {
  export type PrimaryKey = {
    columns: string[];
    options?: { name?: string };
  };

  export type Index = {
    columns: IndexColumnOptions[];
    options: IndexOptions;
  };

  export type Constraint = {
    name?: string;
    check?: Check;
    identity?: Identity;
    references?: References;
    dropMode?: DropMode;
  };

  export type Check = RawSQLBase;

  export type References = {
    columns: string[];
    fnOrTable: (() => ForeignKeyTable) | string;
    foreignColumns: string[];
    options?: ForeignKeyOptions;
  };

  export type Identity = {
    always?: boolean;
  } & Omit<SequenceOptions, 'dataType' | 'ownedBy'>;

  export type SequenceOptions = {
    dataType?: 'smallint' | 'integer' | 'bigint';
    incrementBy?: number;
    startWith?: number;
    min?: number;
    max?: number;
    cache?: number;
    cycle?: boolean;
    ownedBy?: string;
  };
}

export const getConstraintKind = (
  it: TableData.Constraint,
): 'constraint' | 'foreignKey' | 'check' => {
  let num = 0;
  for (const key in it) {
    if (
      (key === 'references' || key === 'check') &&
      it[key as keyof typeof it] !== undefined
    ) {
      num++;
    }
  }
  return num === 1 ? (it.references ? 'foreignKey' : 'check') : 'constraint';
};

export const newTableData = (): TableData => ({});

let tableData: TableData = newTableData();

export const getTableData = () => tableData;

export const resetTableData = (data: TableData = newTableData()) => {
  tableData = data;
};

export const getColumnTypes = <ColumnTypes, Shape extends ColumnsShapeBase>(
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

export type DefaultColumnTypes = TimestampHelpers & {
  name<T extends ColumnTypesBase>(this: T, name: string): T;

  sql<T extends ColumnTypesBase>(
    this: T,
    sql: TemplateStringsArray,
    ...values: unknown[]
  ): RawSQLBase<ColumnType, T>;
  sql<T extends ColumnTypesBase>(
    this: T,
    sql: string,
  ): RawSQLBase<ColumnType, T>;
  sql<T extends ColumnTypesBase>(
    this: T,
    values: Record<string, unknown>,
    sql: string,
  ): RawSQLBase<ColumnType, T>;
  sql<T extends ColumnTypesBase>(
    this: T,
    values: Record<string, unknown>,
  ): (...sql: TemplateLiteralArgs) => RawSQLBase<ColumnType, T>;
  sql(
    ...args:
      | [sql: TemplateStringsArray, ...values: unknown[]]
      | [sql: string]
      | [values: Record<string, unknown>, sql?: string]
  ): ((...sql: TemplateLiteralArgs) => RawSQLBase) | RawSQLBase;

  smallint(): SmallIntColumn;
  integer(): IntegerColumn;
  bigint(): BigIntColumn;
  numeric<
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(
    precision?: Precision,
    scale?: Scale,
  ): DecimalColumn<Precision, Scale>;
  decimal<
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(
    precision?: Precision,
    scale?: Scale,
  ): DecimalColumn<Precision, Scale>;
  real(): RealColumn;
  doublePrecision(): DoublePrecisionColumn;
  identity(options?: TableData.Identity): IdentityColumn<IntegerColumn>;
  smallSerial(): IdentityColumn<SmallSerialColumn>;
  serial(): SerialColumn;
  bigSerial(): BigSerialColumn;
  money(): MoneyColumn;
  varchar<Limit extends number | undefined = undefined>(
    limit?: Limit,
  ): VarCharColumn<Limit>;
  char<Limit extends number | undefined = undefined>(
    limit?: Limit,
  ): CharColumn<Limit>;
  text(min: number, max: number): TextColumn;
  // `varchar` column with optional limit defaulting to 255.
  string<Limit extends number = 255>(limit?: Limit): VarCharColumn<Limit>;
  citext(min: number, max: number): CitextColumn;
  bytea(): ByteaColumn;
  date(): DateColumn;
  timestampNoTZ<Precision extends number>(
    precision?: Precision,
  ): TimestampColumn<Precision>;
  timestamp<Precision extends number | undefined = undefined>(
    precision?: Precision,
  ): TimestampTZColumn<Precision>;
  time<Precision extends number | undefined = undefined>(
    precision?: Precision,
  ): TimeColumn<Precision>;
  interval<
    Fields extends string | undefined = undefined,
    Precision extends number | undefined = undefined,
  >(
    fields?: Fields,
    precision?: Precision,
  ): IntervalColumn<Fields, Precision>;
  boolean(): BooleanColumn;
  enum<U extends string, T extends [U, ...U[]]>(
    dataType: string,
    type: T,
  ): EnumColumn<U, T>;
  point(): PointColumn;
  line(): LineColumn;
  lseg(): LsegColumn;
  box(): BoxColumn;
  path(): PathColumn;
  polygon(): PolygonColumn;
  circle(): CircleColumn;
  cidr(): CidrColumn;
  inet(): InetColumn;
  macaddr(): MacAddrColumn;
  macaddr8(): MacAddr8Column;
  bit<Length extends number>(length: Length): BitColumn<Length>;
  bitVarying<Length extends number | undefined = undefined>(
    length?: Length,
  ): BitVaryingColumn<Length>;
  tsvector(): TsVectorColumn;
  tsquery(): TsQueryColumn;
  uuid(): UUIDColumn;
  xml(): XMLColumn;
  json<Type extends JSONType = JSONUnknown>(
    schemaOrFn?: Type | ((j: JSONTypes) => Type),
  ): JSONColumn<Type>;
  jsonText(): JSONTextColumn;
  array<Item extends ColumnType>(item: Item): ArrayColumn<Item>;
  type(dataType: string): CustomTypeColumn;
  domain(dataType: string): DomainColumn;

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
};

export const columnTypes: DefaultColumnTypes = {
  name,

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
      new RawSQL(args, arg as Record<string, unknown>);
  },

  smallint() {
    return new SmallIntColumn();
  },
  integer() {
    return new IntegerColumn();
  },
  bigint() {
    return new BigIntColumn();
  },
  numeric(precision, scale) {
    return new DecimalColumn(precision, scale);
  },
  decimal(precision, scale) {
    return new DecimalColumn(precision, scale);
  },
  real() {
    return new RealColumn();
  },
  doublePrecision() {
    return new DoublePrecisionColumn();
  },
  identity(options) {
    return new IntegerColumn().identity(options);
  },
  smallSerial() {
    return new SmallSerialColumn();
  },
  serial() {
    return new SerialColumn();
  },
  bigSerial() {
    return new BigSerialColumn();
  },
  money() {
    return new MoneyColumn();
  },
  varchar(limit) {
    return new VarCharColumn(limit);
  },
  char(limit) {
    return new CharColumn(limit);
  },
  text(min, max) {
    return new TextColumn(min, max);
  },
  string<Limit extends number = 255>(limit = 255 as Limit) {
    return new VarCharColumn(limit);
  },
  citext(min, max) {
    return new CitextColumn(min, max);
  },
  bytea() {
    return new ByteaColumn();
  },
  date() {
    return new DateColumn();
  },
  timestampNoTZ(precision) {
    return new TimestampColumn(precision);
  },
  timestamp(precision) {
    return new TimestampTZColumn(precision);
  },
  time(precision) {
    return new TimeColumn(precision);
  },
  interval(fields, precision) {
    return new IntervalColumn(fields, precision);
  },
  boolean() {
    return new BooleanColumn();
  },
  enum(dataType, type) {
    return new EnumColumn(dataType, type);
  },
  point() {
    return new PointColumn();
  },
  line() {
    return new LineColumn();
  },
  lseg() {
    return new LsegColumn();
  },
  box() {
    return new BoxColumn();
  },
  path() {
    return new PathColumn();
  },
  polygon() {
    return new PolygonColumn();
  },
  circle() {
    return new CircleColumn();
  },
  cidr() {
    return new CidrColumn();
  },
  inet() {
    return new InetColumn();
  },
  macaddr() {
    return new MacAddrColumn();
  },
  macaddr8() {
    return new MacAddr8Column();
  },
  bit(length) {
    return new BitColumn(length);
  },
  bitVarying(length) {
    return new BitVaryingColumn(length);
  },
  tsvector() {
    return new TsVectorColumn();
  },
  tsquery() {
    return new TsQueryColumn();
  },
  uuid() {
    return new UUIDColumn();
  },
  xml() {
    return new XMLColumn();
  },
  json(schemaOrFn) {
    return new JSONColumn(schemaOrFn);
  },
  jsonText() {
    return new JSONTextColumn();
  },
  array(item) {
    return new ArrayColumn(item);
  },
  type(dataType) {
    return new CustomTypeColumn(dataType);
  },
  domain(dataType) {
    return new DomainColumn(dataType);
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

  ...makeTimestampsHelpers(
    makeRegexToFindInSql('\\bupdatedAt\\b"?\\s*='),
    '"updatedAt"',
    makeRegexToFindInSql('\\bupdated_at\\b"?\\s*='),
    '"updated_at"',
  ),
};

RawSQL.prototype.columnTypes = columnTypes;
