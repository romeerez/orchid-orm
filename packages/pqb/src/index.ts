// Public API exports for pqb package
// These are the only exports that are considered part of the public API

// Core query building
export { createDbWithAdapter } from './query/db';
export { getColumnInfo } from './query/extra-features/get-column-info/get-column-info';
export { copyTableData } from './query/extra-features/copy-table-data/copy-table-data';
export { testTransaction } from './testTransaction';

// SQL expressions - sql and raw are available via the sql property of column types

// Error types
export { NotFoundError, QueryError } from './query/errors';

// Query helper types - module doesn't exist at this path

// Base Column class
export { Column } from './columns/column';

// Geometric and other column types (all from string.ts)
export {
  TextBaseColumn,
  LimitedTextBaseColumn,
  VarCharColumn,
  StringColumn,
  TextColumn,
  ByteaColumn,
  CitextColumn,
  PointColumn,
  LineColumn,
  LsegColumn,
  BoxColumn,
  PathColumn,
  PolygonColumn,
  CircleColumn,
  MoneyColumn,
  CidrColumn,
  InetColumn,
  MacAddrColumn,
  MacAddr8Column,
  TsVectorColumn,
  TsQueryColumn,
  UUIDColumn,
  XMLColumn,
} from './columns/column-types/string';

// Number column types
export {
  NumberBaseColumn,
  IntegerBaseColumn,
  NumberAsStringBaseColumn,
  DecimalColumn,
  SmallIntColumn,
  IntegerColumn,
  BigIntColumn,
  RealColumn,
  DoublePrecisionColumn,
  SmallSerialColumn,
  SerialColumn,
  BigSerialColumn,
} from './columns/column-types/number';

// Date/time column types
export {
  DateBaseColumn,
  DateColumn,
  DateTimeBaseClass,
  DateTimeTzBaseClass,
  TimestampColumn,
  TimestampTZColumn,
  TimeColumn,
  IntervalColumn,
} from './columns/column-types/date-time';

// Boolean column type
export { BooleanColumn } from './columns/column-types/boolean';

// Custom type and domain columns
export {
  CustomTypeColumn,
  DomainColumn,
} from './columns/column-types/custom-type';

// JSON column types
export { JSONColumn, JSONTextColumn } from './columns/column-types/json';

// Array column type
export { ArrayColumn } from './columns/column-types/array';
