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
  InetColumn,
  LineColumn,
  LsegColumn,
  MacAddrColumn,
  MacAddr8Column,
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
import { JSONColumn, JSONTextColumn, JSONTypes, JSONTypeAny } from './json';
import { ArrayColumn } from './array';
import {
  ColumnNameOfTable,
  ColumnType,
  ColumnTypesBase,
  ForeignKeyTable,
  IndexColumnOptions,
  IndexOptions,
  ForeignKeyOptions,
  ForeignKeyTableWithColumns,
} from './columnType';
import {
  emptyObject,
  EmptyObject,
  makeRegexToFindInSql,
  MaybeArray,
  pushOrNewArrayToObject,
  toArray,
} from '../utils';
import { ColumnsShape } from './columnsSchema';
import { getRawSql, isRaw, raw } from '../raw';
import {
  QueryData,
  UpdatedAtDataInjector,
  UpdateQueryData,
  UpdateQueryDataItem,
} from '../sql';

export type ColumnTypes = typeof columnTypes;

export type TableData = {
  primaryKey?: TableData.PrimaryKey;
  indexes: TableData.Index[];
  foreignKeys: TableData.ForeignKey[];
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

  export type ForeignKey = {
    columns: string[];
    fnOrTable: (() => ForeignKeyTable) | string;
    foreignColumns: string[];
    options: ForeignKeyOptions;
  };
}

export const newTableData = (): TableData => ({
  indexes: [],
  foreignKeys: [],
});

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

const text = (min: number, max: number) => new TextColumn(min, max);

function timestamps<T extends ColumnType>(this: {
  timestamp(): T;
}): {
  createdAt: T & { hasDefault: true };
  updatedAt: T & { hasDefault: true };
} {
  return {
    createdAt: this.timestamp().default(raw('now()')),
    updatedAt: this.timestamp()
      .default(raw('now()'))
      .modifyQuery(addHookForUpdate),
  };
}

const updatedAtRegex = makeRegexToFindInSql('\\bupdatedAt\\b"?\\s*=');
const updateUpdatedAtItem = raw('"updatedAt" = now()');

const addHookForUpdate = (q: { query: QueryData }) => {
  pushOrNewArrayToObject(
    q.query as UpdateQueryData,
    'updateData',
    updatedAtInjector,
  );
};

const updatedAtInjector: UpdatedAtDataInjector = (data) => {
  return checkIfDataHasUpdatedAt(data) ? undefined : updateUpdatedAtItem;
};

const checkIfDataHasUpdatedAt = (data: UpdateQueryDataItem[]) => {
  return data.some((item) => {
    if (isRaw(item)) {
      updatedAtRegex.lastIndex = 0;
      return updatedAtRegex.test(getRawSql(item));
    } else {
      return typeof item !== 'function' && item.updatedAt;
    }
  });
};

export type DefaultColumnTypes = typeof columnTypes;
export const columnTypes = {
  smallint: () => new SmallIntColumn(),
  integer: () => new IntegerColumn(),
  bigint: () => new BigIntColumn(),
  numeric: <
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(
    precision?: Precision,
    scale?: Scale,
  ) => new DecimalColumn(precision, scale),
  decimal: <
    Precision extends number | undefined = undefined,
    Scale extends number | undefined = undefined,
  >(
    precision?: Precision,
    scale?: Scale,
  ) => new DecimalColumn(precision, scale),
  real: () => new RealColumn(),
  doublePrecision: () => new DoublePrecisionColumn(),
  smallSerial: () => new SmallSerialColumn(),
  serial: () => new SerialColumn(),
  bigSerial: () => new BigSerialColumn(),
  money: () => new MoneyColumn(),
  varchar: <Limit extends number | undefined = undefined>(limit?: Limit) =>
    new VarCharColumn(limit),
  char: <Limit extends number | undefined = undefined>(limit?: Limit) =>
    new CharColumn(limit),
  text,
  string: text,
  bytea: () => new ByteaColumn(),
  date: () => new DateColumn(),
  timestamp: <Precision extends number>(precision?: Precision) =>
    new TimestampColumn(precision),
  timestampWithTimeZone: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimestampWithTimeZoneColumn(precision),
  time: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimeColumn(precision),
  timeWithTimeZone: <Precision extends number | undefined = undefined>(
    precision?: Precision,
  ) => new TimeWithTimeZoneColumn(precision),
  interval: <
    Fields extends string | undefined = undefined,
    Precision extends number | undefined = undefined,
  >(
    fields?: Fields,
    precision?: Precision,
  ) => new IntervalColumn(fields, precision),
  boolean: () => new BooleanColumn(),
  enum: <U extends string, T extends [U, ...U[]]>(dataType: string, type: T) =>
    new EnumColumn<U, T>(dataType, type),
  point: () => new PointColumn(),
  line: () => new LineColumn(),
  lseg: () => new LsegColumn(),
  box: () => new BoxColumn(),
  path: () => new PathColumn(),
  polygon: () => new PolygonColumn(),
  circle: () => new CircleColumn(),
  cidr: () => new CidrColumn(),
  inet: () => new InetColumn(),
  macaddr: () => new MacAddrColumn(),
  macaddr8: () => new MacAddr8Column(),
  bit: <Length extends number>(length: Length) => new BitColumn(length),
  bitVarying: <Length extends number | undefined = undefined>(
    length?: Length,
  ) => new BitVaryingColumn(length),
  tsvector: () => new TsVectorColumn(),
  tsquery: () => new TsQueryColumn(),
  uuid: () => new UUIDColumn(),
  xml: () => new XMLColumn(),
  json: <Type extends JSONTypeAny>(
    schemaOrFn: Type | ((j: JSONTypes) => Type),
  ) => new JSONColumn(schemaOrFn),
  jsonText: () => new JSONTextColumn(),
  array: <Item extends ColumnType>(item: Item) => new ArrayColumn(item),

  timestamps,

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

    tableData.indexes.push(index);
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

    tableData.indexes.push(index);

    return emptyObject;
  },

  foreignKey,
};

function foreignKey<
  Table extends ForeignKeyTableWithColumns,
  Columns extends [ColumnNameOfTable<Table>, ...ColumnNameOfTable<Table>[]],
>(
  columns: string[],
  fn: () => Table,
  foreignColumns: Columns,
  options?: ForeignKeyOptions,
): EmptyObject;
function foreignKey<
  Table extends string,
  Columns extends [string, ...string[]],
>(
  columns: string[],
  table: Table,
  foreignColumns: Columns,
  options?: ForeignKeyOptions,
): EmptyObject;
function foreignKey(
  columns: string[],
  fnOrTable: (() => ForeignKeyTable) | string,
  foreignColumns: string[],
  options: ForeignKeyOptions = {},
) {
  const foreignKey = {
    columns,
    fnOrTable,
    foreignColumns,
    options,
  };

  tableData.foreignKeys.push(foreignKey);
  return emptyObject;
}
