// Public API exports for pqb package
// These are the only exports that are considered part of the public API

export { type PickQueryInputType, type SqlFn } from './query';

export {
  type OperatorsArray,
  type OperatorsJson,
  type OperatorsOrdinalText,
  type Ord,
} from './columns/operators';

export {
  type Timestamps,
  type DecimalColumnData,
  type NumberColumnData,
  type ArrayData,
  type DateColumnData,
  type SerialColumnData,
} from './columns';

export {
  applyMixins,
  deepCompare,
  emptyArray,
  emptyObject,
  getCallerFilePath,
  getFreeAlias,
  getFreeSetAlias,
  getImportPath,
  getStackTrace,
  noop,
  omit,
  objectHasValues,
  pathToLog,
  pick,
  pluralize,
  returnArg,
  setFreeAlias,
  singleQuote,
  toArray,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  type EmptyObject,
  type EmptyTuple,
  type MaybeArray,
  type MaybePromise,
  type RecordKeyTrue,
  type RecordOptionalString,
  type RecordString,
  type RecordStringOrNumber,
  type RecordUnknown,
  type ShallowSimplify,
} from './utils';

// Snake case key symbol
export { snakeCaseKey } from './columns/types';

// TableData - table configuration and metadata
export {
  parseTableData,
  parseTableDataInput,
  tableDataMethods,
  type NonUniqDataItem,
  type TableData,
  type TableDataFn,
  type TableDataInput,
  type TableDataItem,
  type TableDataItemsUniqueColumnTuples,
  type TableDataItemsUniqueColumns,
  type TableDataItemsUniqueConstraints,
  type TableDataMethods,
  type UniqueTableDataItem,
} from './tableData';

// Column schema configuration
export {
  defaultSchemaConfig,
  getColumnTypes,
  makeColumnTypes,
  setColumnData,
  setColumnEncode,
  setColumnParse,
  setColumnParseNull,
  setDataValue,
  makeColumnNullable,
  TextBaseColumn,
  LimitedTextBaseColumn,
  NumberBaseColumn,
  IntegerBaseColumn,
  NumberAsStringBaseColumn,
  DateBaseColumn,
  DateTimeBaseClass,
  DateTimeTzBaseClass,
  Column,
  type ColumnSchemaConfig,
  type ColumnSchemaGetterColumns,
  type ColumnSchemaGetterTableClass,
  type ColumnTypeSchemaArg,
  type DefaultColumnTypes,
  type DefaultSchemaConfig,
} from './columns';

// Operators
export { Operators } from './columns/operators';

// Column data types and utilities
export {
  type StringData,
  type BaseNumberData,
} from './columns/column-data-types';

// Columns shape
export { type ColumnsShape } from './columns/columns-shape';

// Hooks - AfterHook type and QueryHooks class
export {
  QueryHooks,
  QueryHookUtils,
  type AfterHook,
} from './query/extra-features/hooks/hooks';

// Select utils
export { getShapeFromSelect } from './query/basic-features/select/select.utils';

// Hook select
export { type HookSelectValue } from './query/basic-features/select/hook-select';

// Query internal types and utilities
export {
  getPrimaryKeys,
  getQuerySchema,
  Db,
  type CreateCtx,
  type CreateData,
  type CreateMethodsNames,
  type CreateManyMethodsNames,
  type CreateSelf,
  type DbDomainArg,
  type DbExtension,
  type DbSharedOptions,
  type DbSqlMethod,
  type DbTableOptionScopes,
  type DbTableOptions,
  type DeleteMethodsNames,
  type GeneratorIgnore,
  type IsQuery,
  type MapTableScopesOption,
  type PickQueryInternal,
  type PickQueryQ,
  type PickQueryRelations,
  type PickQuerySelectableRelations,
  type PickQueryShape,
  type Query,
  type QueryAfterHook,
  type QueryBeforeActionHook,
  type QueryBeforeHook,
  type QueryData,
  type QueryHasWhere,
  type QueryInternal,
  type QueryManyTake,
  type QueryManyTakeOptional,
  type QueryOrExpression,
  type QueryReturnType,
  type QuerySchema,
  type QueryScopes,
  type SelectableFromShape,
  type ShapeColumnPrimaryKeys,
  type ShapeUniqueColumns,
  type SingleSqlItem,
  type Sql,
  type UniqueConstraints,
  type UpdateData,
  type WhereArg,
} from './query';

// Internal query functions (prefixed with _)
export {
  _appendQuery,
  _clone,
  _createDbSqlMethod,
  _hookSelectColumns,
  _orCreate,
  _prependWith,
  _queryCreate,
  _queryCreateMany,
  _queryCreateManyFrom,
  _queryDefaults,
  _queryDelete,
  _queryFindBy,
  _queryFindByOptional,
  _queryHookAfterCreate,
  _queryHookAfterUpdate,
  _queryInsert,
  _queryInsertMany,
  _queryJoinOn,
  _queryRows,
  _querySelect,
  _queryTake,
  _queryTakeOptional,
  _queryUpdate,
  _queryUpdateOrThrow,
  _queryUpsert,
  _queryWhere,
  _queryWhereExists,
  _queryWhereIn,
  cloneQueryBaseUnscoped,
  isQueryReturnsAll,
  prepareSubQueryForSql,
} from './query';

// Column types (internal access)
export {
  ArrayColumn,
  BigIntColumn,
  BigSerialColumn,
  BitColumn,
  BitVaryingColumn,
  BooleanColumn,
  BoxColumn,
  ByteaColumn,
  CidrColumn,
  CircleColumn,
  CitextColumn,
  CustomTypeColumn,
  DateColumn,
  DecimalColumn,
  DomainColumn,
  DoublePrecisionColumn,
  EnumColumn,
  InetColumn,
  IntegerColumn,
  IntervalColumn,
  JSONColumn,
  JSONTextColumn,
  LineColumn,
  LsegColumn,
  MacAddr8Column,
  MacAddrColumn,
  MoneyColumn,
  PathColumn,
  PointColumn,
  PolygonColumn,
  PostgisGeographyPointColumn,
  RealColumn,
  SerialColumn,
  SmallIntColumn,
  SmallSerialColumn,
  StringColumn,
  TextColumn,
  TimeColumn,
  TimestampColumn,
  TimestampTZColumn,
  TsQueryColumn,
  TsVectorColumn,
  UUIDColumn,
  VarCharColumn,
  XMLColumn,
  type ArrayColumnValue,
} from './columns';

// Virtual column (internal)
export { VirtualColumn } from './columns/column-types/virtual';

// Raw SQL types
export {
  isRawSQL,
  rawSqlToCode,
  DynamicRawSQL,
  type RawSqlBase,
} from './query/expressions/raw-sql';
export {
  getSqlText,
  quoteTableWithSchema,
  type SingleSql,
} from './query/sql/sql';

// RawSql for relations
export { RawSql } from './query/expressions/raw-sql';

// Query utilities
export { setQueryObjectValueImmutable } from './query/query.utils';

// SearchWeight
export { type SearchWeight } from './query/extra-features/search/search.sql';

// Relations
export {
  type RelationConfigBase,
  type RelationJoinQuery,
  type RelationsBase,
} from './query/relations';

// Expression types
export {
  Expression,
  isExpression,
  type TemplateLiteralArgs,
} from './query/expressions/expression';

// Query basic features - AS
export { getQueryAs } from './query/basic-features/as/as';
export { raw } from './query/expressions/raw-sql';
export { addTopCte, addTopCteSql } from './query/basic-features/cte/cte.sql';
export {
  type JoinQueryMethod,
  pushQueryOnForOuter,
} from './query/basic-features/join/join';
export {
  type FromArg,
  type FromResult,
} from './query/basic-features/from/from';

// Merge
export { type MergeQuery } from './query/extra-features/merge/merge';

// Colors
export { colors } from './utils';

// QueryLogger
export {
  logParamToLogObject,
  logColors,
  type QueryLogger,
  type QueryLogObject,
  type QueryLogOptions,
} from './query/basic-features/log/log';

// Storage
export { type StorageOptions } from './query/basic-features/storage/storage';

// String escaping
export { escapeString, escapeForMigration } from './quote';
export { backtickQuote, quoteObjectKey } from './utils';

// Utility functions
export { exhaustive } from './utils';

// Adapter
export {
  setConnectRetryConfig,
  wrapAdapterFnWithConnectRetry,
  type AdapterBase,
  type AdapterConfigBase,
  type QueryResult,
  type QueryArraysResult,
  type QueryResultRow,
  type TransactionAdapterBase,
  type TransactionArgs,
  type AfterCommitStandaloneHook,
} from './adapters/adapter';

// Default privileges
export {
  getSupportedDefaultPrivileges,
  type DefaultPrivileges,
} from './query/extra-features/default-privileges/default-privileges';

// Computed columns
export {
  type ComputedColumnsFromOptions,
  type ComputedOptionsConfig,
  type ComputedOptionsFactory,
} from './query/extra-features/computed/computed';

// NoPrimaryKeyOption
export { type NoPrimaryKeyOption } from './query/db';

// _initQueryBuilder and DbResult
export {
  _initQueryBuilder,
  createDbWithAdapter,
  type DbResult,
  type DbOptions,
} from './query/db';

// AsyncState
export { type AsyncState } from './query/basic-features/storage/storage';

// Column utilities
export {
  type DbStructureDomainsMap,
  getColumnBaseType,
} from './columns/column.utils';

// Column from db utilities
export {
  assignDbDataToColumn,
  type ColumnFromDbParams,
} from './columns/column-from-db.utils';

// Columns by type
export {
  makeColumnsByType,
  type ColumnsByType,
} from './columns/columns-by-type';

// Code generation utilities
export {
  addCode,
  codeToString,
  columnsShapeToCode,
  constraintInnerToCode,
  excludeInnerToCode,
  indexInnerToCode,
  primaryKeyInnerToCode,
  pushTableDataCode,
  referencesArgsToCode,
  type ColumnToCodeCtx,
  type Code,
  type Codes,
} from './columns/code';

// Query data utilities
export {
  pushQueryValueImmutable,
  getClonedQueryData,
  type JoinedShapes,
} from './query/query-data';

// Upsert types
export {
  type UpsertData,
  type UpsertThis,
} from './query/basic-features/mutate/upsert';

// Column name management (for migrations)
export {
  setCurrentColumnName,
  consumeColumnName,
  setDefaultLanguage,
} from './columns/column';

// Unknown column (for raw SQL)
export { UnknownColumn } from './columns/column-types/unknown';

// Transaction
export {
  type IsolationLevel,
  type TransactionOptions,
} from './query/basic-features/transaction/transaction';

// --- PUBLIC BELOW --- //

// Core query building
export { getColumnInfo } from './query/extra-features/get-column-info/get-column-info';
export { copyTableData } from './query/extra-features/copy-table-data/copy-table-data';
export { testTransaction } from './testTransaction';

// Error types
export {
  OrchidOrmInternalError,
  NotFoundError,
  QueryError,
} from './query/errors';
