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
  TimestampWithTimeZoneColumn,
  TimeWithTimeZoneColumn,
} from './dateTime';
import { BooleanColumn } from './boolean';
import { EnumColumn } from './enum';
import { JSONColumn, JSONTextColumn, JSONTypes } from './json';
import {
  ColumnTypesBase,
  EmptyObject,
  emptyObject,
  JSONTypeAny,
  makeTimestampsHelpers,
  MaybeArray,
  name,
  raw,
  RawExpression,
  toArray,
} from 'orchid-core';
import { ArrayColumn } from './array';
import {
  ColumnNameOfTable,
  ColumnType,
  DropMode,
  ForeignKeyTable,
  IndexColumnOptions,
  IndexOptions,
  ForeignKeyOptions,
} from './columnType';
import { makeRegexToFindInSql } from '../utils';
import { ColumnsShape } from './columnsSchema';
import { CustomTypeColumn, DomainColumn } from './customType';

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

  export type Check = RawExpression;

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
  data: TableData = newTableData(),
) => {
  resetTableData(data);
  return fn(types);
};

function text(this: ColumnTypesBase, min: number, max: number) {
  return new TextColumn(this, min, max);
}

export type DefaultColumnTypes = typeof columnTypes;
export const columnTypes = {
  name,
  raw,
  smallint(this: ColumnTypesBase) {
    return new SmallIntColumn(this);
  },
  integer(this: ColumnTypesBase) {
    return new IntegerColumn(this);
  },
  bigint(this: ColumnTypesBase) {
    return new BigIntColumn(this);
  },
  numeric<
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(this: ColumnTypesBase, precision?: Precision, scale?: Scale) {
    return new DecimalColumn(this, precision, scale);
  },
  decimal<
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(this: ColumnTypesBase, precision?: Precision, scale?: Scale) {
    return new DecimalColumn(this, precision, scale);
  },
  real(this: ColumnTypesBase) {
    return new RealColumn(this);
  },
  doublePrecision(this: ColumnTypesBase) {
    return new DoublePrecisionColumn(this);
  },
  identity(this: ColumnTypesBase, options?: TableData.Identity) {
    return new IntegerColumn(this).identity(options);
  },
  smallSerial(this: ColumnTypesBase) {
    return new SmallSerialColumn(this);
  },
  serial(this: ColumnTypesBase) {
    return new SerialColumn(this);
  },
  bigSerial(this: ColumnTypesBase) {
    return new BigSerialColumn(this);
  },
  money(this: ColumnTypesBase) {
    return new MoneyColumn(this);
  },
  varchar<Limit extends number | undefined = undefined>(
    this: ColumnTypesBase,
    limit?: Limit,
  ) {
    return new VarCharColumn(this, limit);
  },
  char<Limit extends number | undefined = undefined>(
    this: ColumnTypesBase,
    limit?: Limit,
  ) {
    return new CharColumn(this, limit);
  },
  text,
  string: text,
  citext(this: ColumnTypesBase, min: number, max: number) {
    return new CitextColumn(this, min, max);
  },
  bytea(this: ColumnTypesBase) {
    return new ByteaColumn(this);
  },
  date(this: ColumnTypesBase) {
    return new DateColumn(this);
  },
  timestamp<Precision extends number>(
    this: ColumnTypesBase,
    precision?: Precision,
  ) {
    return new TimestampColumn(this, precision);
  },
  timestampWithTimeZone<Precision extends number | undefined = undefined>(
    this: ColumnTypesBase,
    precision?: Precision,
  ) {
    return new TimestampWithTimeZoneColumn(this, precision);
  },
  time<Precision extends number | undefined = undefined>(
    this: ColumnTypesBase,
    precision?: Precision,
  ) {
    return new TimeColumn(this, precision);
  },
  timeWithTimeZone<Precision extends number | undefined = undefined>(
    this: ColumnTypesBase,
    precision?: Precision,
  ) {
    return new TimeWithTimeZoneColumn(this, precision);
  },
  interval<
    Fields extends string | undefined = undefined,
    Precision extends number | undefined = undefined,
  >(this: ColumnTypesBase, fields?: Fields, precision?: Precision) {
    return new IntervalColumn(this, fields, precision);
  },
  boolean(this: ColumnTypesBase) {
    return new BooleanColumn(this);
  },
  enum<U extends string, T extends [U, ...U[]]>(
    this: ColumnTypesBase,
    dataType: string,
    type: T,
  ) {
    return new EnumColumn<U, T>(this, dataType, type);
  },
  point(this: ColumnTypesBase) {
    return new PointColumn(this);
  },
  line(this: ColumnTypesBase) {
    return new LineColumn(this);
  },
  lseg(this: ColumnTypesBase) {
    return new LsegColumn(this);
  },
  box(this: ColumnTypesBase) {
    return new BoxColumn(this);
  },
  path(this: ColumnTypesBase) {
    return new PathColumn(this);
  },
  polygon(this: ColumnTypesBase) {
    return new PolygonColumn(this);
  },
  circle(this: ColumnTypesBase) {
    return new CircleColumn(this);
  },
  cidr(this: ColumnTypesBase) {
    return new CidrColumn(this);
  },
  inet(this: ColumnTypesBase) {
    return new InetColumn(this);
  },
  macaddr(this: ColumnTypesBase) {
    return new MacAddrColumn(this);
  },
  macaddr8(this: ColumnTypesBase) {
    return new MacAddr8Column(this);
  },
  bit<Length extends number>(this: ColumnTypesBase, length: Length) {
    return new BitColumn(this, length);
  },
  bitVarying<Length extends number | undefined = undefined>(
    this: ColumnTypesBase,
    length?: Length,
  ) {
    return new BitVaryingColumn(this, length);
  },
  tsvector(this: ColumnTypesBase) {
    return new TsVectorColumn(this);
  },
  tsquery(this: ColumnTypesBase) {
    return new TsQueryColumn(this);
  },
  uuid(this: ColumnTypesBase) {
    return new UUIDColumn(this);
  },
  xml(this: ColumnTypesBase) {
    return new XMLColumn(this);
  },
  json<Type extends JSONTypeAny>(
    this: ColumnTypesBase,
    schemaOrFn: Type | ((j: JSONTypes) => Type),
  ) {
    return new JSONColumn(this, schemaOrFn);
  },
  jsonText(this: ColumnTypesBase) {
    return new JSONTextColumn(this);
  },
  array<Item extends ColumnType>(this: ColumnTypesBase, item: Item) {
    return new ArrayColumn(this, item);
  },
  type(this: ColumnTypesBase, dataType: string) {
    return new CustomTypeColumn(this, dataType);
  },
  domain(this: ColumnTypesBase, dataType: string) {
    return new DomainColumn(this, dataType);
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
    check?: RawExpression;
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

  check(check: RawExpression): EmptyObject {
    (tableData.constraints ??= []).push({
      check,
    });
    return emptyObject;
  },

  ...makeTimestampsHelpers(
    makeRegexToFindInSql('\\bupdatedAt\\b"?\\s*='),
    raw('"updatedAt" = now()'),
    makeRegexToFindInSql('\\bupdated_at\\b"?\\s*='),
    raw('"updated_at" = now()'),
  ),
};
