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
  StringColumn,
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

export type DefaultColumnTypes<
  SchemaConfig extends ColumnSchemaConfig,
  NumberMethods = SchemaConfig['numberMethods'],
  StringMethods = SchemaConfig['stringMethods'],
  DateMethods = SchemaConfig['dateMethods'],
> = TimestampHelpers & {
  schema: SchemaConfig;
  enum: SchemaConfig['enum'];
  array: SchemaConfig['array'];

  name<T>(this: T, name: string): T;

  sql<T>(
    this: T,
    sql: TemplateStringsArray,
    ...values: unknown[]
  ): RawSQLBase<QueryColumn, T>;
  sql<T>(this: T, sql: string): RawSQLBase<QueryColumn, T>;
  sql<T>(
    this: T,
    values: Record<string, unknown>,
    sql: string,
  ): RawSQLBase<QueryColumn, T>;
  sql<T>(
    this: T,
    values: Record<string, unknown>,
  ): (...sql: TemplateLiteralArgs) => RawSQLBase<QueryColumn, T>;
  sql(
    ...args:
      | [sql: TemplateStringsArray, ...values: unknown[]]
      | [sql: string]
      | [values: Record<string, unknown>, sql?: string]
  ): ((...sql: TemplateLiteralArgs) => RawSQLBase) | RawSQLBase;

  smallint(): SmallIntColumn<SchemaConfig> & NumberMethods;
  integer(): IntegerColumn<SchemaConfig> & NumberMethods;
  bigint(): BigIntColumn<SchemaConfig> & StringMethods;
  numeric(
    precision?: number,
    scale?: number,
  ): DecimalColumn<SchemaConfig> & StringMethods;
  decimal(
    precision?: number,
    scale?: number,
  ): DecimalColumn<SchemaConfig> & StringMethods;
  real(): RealColumn<SchemaConfig> & NumberMethods;
  doublePrecision(): DoublePrecisionColumn<SchemaConfig> & StringMethods;
  identity(
    options?: TableData.Identity,
  ): IdentityColumn<IntegerColumn<SchemaConfig> & NumberMethods>;
  smallSerial(): SmallSerialColumn<SchemaConfig> & NumberMethods;
  serial(): SerialColumn<SchemaConfig> & NumberMethods;
  bigSerial(): BigSerialColumn<SchemaConfig> & StringMethods;
  money(): MoneyColumn<SchemaConfig> & StringMethods;
  varchar(limit?: number): VarCharColumn<SchemaConfig> & StringMethods;
  char(limit?: number): CharColumn<SchemaConfig> & StringMethods;
  text(min: number, max: number): TextColumn<SchemaConfig> & StringMethods;
  // `varchar` column with optional limit defaulting to 255.
  string(limit?: number): StringColumn<SchemaConfig> & StringMethods;
  citext(min: number, max: number): CitextColumn<SchemaConfig> & StringMethods;
  bytea(): ByteaColumn<SchemaConfig>;
  date(): DateColumn<SchemaConfig> & DateMethods;
  timestampNoTZ(
    precision?: number,
  ): TimestampColumn<SchemaConfig> & DateMethods;
  timestamp(precision?: number): TimestampTZColumn<SchemaConfig> & DateMethods;
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
};

export const makeColumnTypes = <SchemaConfig extends ColumnSchemaConfig>(
  schema: SchemaConfig,
): DefaultColumnTypes<SchemaConfig> => {
  const columnsWithMethods: Record<
    string,
    { new (...args: unknown[]): unknown }
  > = {};

  function columnWithMethods<
    Methods extends Record<string, unknown>,
    Args extends unknown[],
    Klass extends { new (...args: Args): EmptyObject },
  >(klass: Klass, methods: Methods, ...args: Args): never {
    if (columnsWithMethods[klass.name]) {
      return new columnsWithMethods[klass.name](...args) as never;
    }

    // @ts-expect-error don't know how to fix that error
    const withMethods = class extends klass {};
    Object.assign(withMethods.prototype, methods);

    return new (columnsWithMethods[klass.name] = withMethods as unknown as {
      new (...args: unknown[]): unknown;
    })(...args) as never;
  }

  const numberMethods = schema.numberMethods;
  const stringMethods = schema.stringMethods;
  const dateMethods = schema.dateMethods;

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
        new RawSQL(args, arg as Record<string, unknown>);
    },

    smallint() {
      return columnWithMethods(SmallIntColumn, numberMethods, schema);
    },
    integer() {
      return columnWithMethods(IntegerColumn, numberMethods, schema);
    },
    bigint() {
      return columnWithMethods(BigIntColumn, stringMethods, schema);
    },
    numeric(precision, scale) {
      return columnWithMethods(
        DecimalColumn,
        stringMethods,
        schema,
        precision,
        scale,
      );
    },
    decimal(precision, scale) {
      return columnWithMethods(
        DecimalColumn,
        stringMethods,
        schema,
        precision,
        scale,
      );
    },
    real() {
      return columnWithMethods(RealColumn, numberMethods, schema);
    },
    doublePrecision() {
      return columnWithMethods(DoublePrecisionColumn, stringMethods, schema);
    },
    identity(options) {
      return (
        columnWithMethods(
          IntegerColumn,
          numberMethods,
          schema,
        ) as IntegerColumn<SchemaConfig>
      ).identity(options) as unknown as IdentityColumn<
        IntegerColumn<SchemaConfig> & SchemaConfig['numberMethods']
      >;
    },
    smallSerial() {
      return columnWithMethods(SmallSerialColumn, numberMethods, schema);
    },
    serial() {
      return columnWithMethods(SerialColumn, numberMethods, schema);
    },
    bigSerial() {
      return columnWithMethods(BigSerialColumn, stringMethods, schema);
    },
    money() {
      return columnWithMethods(MoneyColumn, stringMethods, schema);
    },
    varchar(limit) {
      return columnWithMethods(VarCharColumn, stringMethods, schema, limit);
    },
    char(limit) {
      return columnWithMethods(CharColumn, stringMethods, schema, limit);
    },
    text(min, max) {
      return columnWithMethods(TextColumn, stringMethods, schema, min, max);
    },
    string(limit = 255) {
      return columnWithMethods(StringColumn, stringMethods, schema, limit);
    },
    citext(min, max) {
      return columnWithMethods(CitextColumn, stringMethods, schema, min, max);
    },
    bytea() {
      return new ByteaColumn<SchemaConfig>(schema);
    },
    date() {
      return columnWithMethods(DateColumn, dateMethods, schema);
    },
    timestampNoTZ(precision) {
      return columnWithMethods(TimestampColumn, dateMethods, schema, precision);
    },
    timestamp(precision) {
      return columnWithMethods(
        TimestampTZColumn,
        dateMethods,
        schema,
        precision,
      );
    },
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

    ...makeTimestampsHelpers(
      makeRegexToFindInSql('\\bupdatedAt\\b"?\\s*='),
      '"updatedAt"',
      makeRegexToFindInSql('\\bupdated_at\\b"?\\s*='),
      '"updated_at"',
    ),
  };
};

RawSQL.prototype.columnTypes = makeColumnTypes;
