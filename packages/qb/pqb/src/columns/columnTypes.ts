import {
  BigIntColumn,
  BigSerialColumn,
  DecimalColumn,
  DoublePrecisionColumn,
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
import { JSONColumn, JSONTextColumn, JSONTypes } from './json';
import {
  ColumnNameOfTable,
  ColumnTypesBase,
  EmptyObject,
  emptyObject,
  ForeignKeyTable,
  JSONTypeAny,
  makeTimestampsHelpers,
  MaybeArray,
  name,
  setDefaultNowFn,
  TemplateLiteralArgs,
  toArray,
  RawSQLBase,
} from 'orchid-core';
import { ArrayColumn } from './array';
import {
  ColumnType,
  DropMode,
  IndexColumnOptions,
  IndexOptions,
  ForeignKeyOptions,
} from './columnType';
import { makeRegexToFindInSql } from '../utils';
import { ColumnsShape } from './columnsSchema';
import { CustomTypeColumn, DomainColumn } from './customType';
import { RawSQL } from '../sql/rawSql';

export type ColumnTypes = typeof columnTypes;

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

export const getColumnTypes = <
  CT extends ColumnTypesBase,
  Shape extends ColumnsShape,
>(
  types: CT,
  fn: (t: CT) => Shape,
  nowSQL: string | undefined,
  data: TableData = newTableData(),
) => {
  if (nowSQL) setDefaultNowFn(nowSQL);

  resetTableData(data);
  return fn(types);
};

function text(min: number, max: number) {
  return new TextColumn(min, max);
}

function sql(sql: TemplateStringsArray, ...values: unknown[]): RawSQLBase;
function sql(sql: string): RawSQLBase;
function sql(values: Record<string, unknown>, sql: string): RawSQLBase;
function sql(
  values: Record<string, unknown>,
): (...sql: TemplateLiteralArgs) => RawSQLBase;
function sql(
  ...args:
    | [sql: TemplateStringsArray, ...values: unknown[]]
    | [sql: string]
    | [values: Record<string, unknown>, sql?: string]
): ((...sql: TemplateLiteralArgs) => RawSQLBase) | RawSQLBase {
  const arg = args[0];
  if (Array.isArray(arg)) {
    return new RawSQL(args as TemplateLiteralArgs);
  }

  if (typeof args[0] === 'string') {
    return new RawSQL(args[0] as string);
  }

  if (args[1] !== undefined) {
    return new RawSQL(args[1] as string, arg as Record<string, unknown>);
  }

  return (...args) => new RawSQL(args, arg as Record<string, unknown>);
}

export type DefaultColumnTypes = typeof columnTypes;
export const columnTypes = {
  name,
  sql,
  smallint() {
    return new SmallIntColumn();
  },
  integer() {
    return new IntegerColumn();
  },
  bigint() {
    return new BigIntColumn();
  },
  numeric<
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(precision?: Precision, scale?: Scale) {
    return new DecimalColumn(precision, scale);
  },
  decimal<
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(precision?: Precision, scale?: Scale) {
    return new DecimalColumn(precision, scale);
  },
  real() {
    return new RealColumn();
  },
  doublePrecision() {
    return new DoublePrecisionColumn();
  },
  identity(options?: TableData.Identity) {
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
  varchar<Limit extends number | undefined = undefined>(limit?: Limit) {
    return new VarCharColumn(limit);
  },
  char<Limit extends number | undefined = undefined>(limit?: Limit) {
    return new CharColumn(limit);
  },
  text,
  string: text,
  citext(min: number, max: number) {
    return new CitextColumn(min, max);
  },
  bytea() {
    return new ByteaColumn();
  },
  date() {
    return new DateColumn();
  },
  timestampNoTZ<Precision extends number>(precision?: Precision) {
    return new TimestampColumn(precision);
  },
  timestamp<Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) {
    return new TimestampTZColumn(precision);
  },
  time<Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) {
    return new TimeColumn(precision);
  },
  interval<
    Fields extends string | undefined = undefined,
    Precision extends number | undefined = undefined,
  >(fields?: Fields, precision?: Precision) {
    return new IntervalColumn(fields, precision);
  },
  boolean() {
    return new BooleanColumn();
  },
  enum<U extends string, T extends [U, ...U[]]>(dataType: string, type: T) {
    return new EnumColumn<U, T>(dataType, type);
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
  bit<Length extends number>(length: Length) {
    return new BitColumn(length);
  },
  bitVarying<Length extends number | undefined = undefined>(length?: Length) {
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
  json<Type extends JSONTypeAny>(schemaOrFn: Type | ((j: JSONTypes) => Type)) {
    return new JSONColumn(schemaOrFn);
  },
  jsonText() {
    return new JSONTextColumn();
  },
  array<Item extends ColumnType>(item: Item) {
    return new ArrayColumn(item);
  },
  type(dataType: string) {
    return new CustomTypeColumn(dataType);
  },
  domain(dataType: string) {
    return new DomainColumn(dataType);
  },

  primaryKey(columns: string[], options?: { name?: string }) {
    tableData.primaryKey = { columns, options };
    return emptyObject;
  },

  index(
    columns: MaybeArray<string | IndexColumnOptions>,
    options: IndexOptions = {},
  ) {
    const index = {
      columns: toArray(columns).map((column) =>
        typeof column === 'string' ? { column } : column,
      ),
      options,
    };

    (tableData.indexes ??= []).push(index);
    return emptyObject;
  },

  unique(
    columns: MaybeArray<string | IndexColumnOptions>,
    options: IndexOptions = {},
  ) {
    const index = {
      columns: toArray(columns).map((column) =>
        typeof column === 'string' ? { column } : column,
      ),
      options: { ...options, unique: true },
    };

    (tableData.indexes ??= []).push(index);

    return emptyObject;
  },

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
  }): EmptyObject {
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
  ): EmptyObject {
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

  check(check: RawSQLBase): EmptyObject {
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
