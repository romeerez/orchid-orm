// Internal exports for use by other first-party packages (orm, rake-db, schemaConfigs, test-factory)
// These are NOT part of the public API and may change without notice.

// Utils
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
  type PickQueryInputType,
  type SqlFn,
  type Timestamps,
  type DecimalColumnData,
  type NumberColumnData,
  type ArrayData,
  type DateColumnData,
  type SerialColumnData,
  type OperatorsArray,
  type OperatorsJson,
  type OperatorsOrdinalText,
  type Ord,
} from './index';

// Snake case key symbol
export { snakeCaseKey } from './index';

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
} from './index';

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
  Column,
  type ColumnSchemaConfig,
  type ColumnSchemaGetterColumns,
  type ColumnSchemaGetterTableClass,
  type ColumnTypeSchemaArg,
  type DefaultColumnTypes,
  type DefaultSchemaConfig,
} from './index';

// Operators
export { Operators } from './index';

// Column data types and utilities
export { type StringData, type BaseNumberData } from './index';

// Columns shape
export { type ColumnsShape } from './index';

// Hooks - AfterHook type and QueryHooks class
export { QueryHooks, QueryHookUtils, type AfterHook } from './index';

// Select utils
export { getShapeFromSelect } from './index';

// Hook select
export { type HookSelectValue } from './index';

// Query internal types and utilities
export {
  getPrimaryKeys,
  getQuerySchema,
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
  type QueryScopes,
  type SelectableFromShape,
  type ShapeColumnPrimaryKeys,
  type ShapeUniqueColumns,
  type SingleSqlItem,
  type Sql,
  type UniqueConstraints,
  type UpdateData,
  type WhereArg,
} from './index';

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
} from './index';

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
} from './index';

// Virtual column (internal)
export { VirtualColumn } from './index';

// Raw SQL types
export {
  isRawSQL,
  rawSqlToCode,
  DynamicRawSQL,
  type RawSqlBase,
} from './index';
export { getSqlText, quoteTableWithSchema, type SingleSql } from './index';

// RawSql for relations
export { RawSql } from './index';

// Query utilities
export { setQueryObjectValueImmutable } from './index';

// SearchWeight
export { type SearchWeight } from './index';

// Relations
export {
  type RelationConfigBase,
  type RelationJoinQuery,
  type RelationsBase,
} from './index';

// Expression types
export { Expression, isExpression, type TemplateLiteralArgs } from './index';

// Query basic features - AS
export { getQueryAs } from './index';
export { raw } from './index';
export { addTopCte, addTopCteSql } from './index';
export { type JoinQueryMethod, pushQueryOnForOuter } from './index';
export { type FromArg, type FromResult } from './index';

// Merge
export { type MergeQuery } from './index';

// Colors
export { colors } from './index';

// QueryLogger
export {
  logParamToLogObject,
  logColors,
  type QueryLogger,
  type QueryLogObject,
  type QueryLogOptions,
} from './index';

// Storage
export { type StorageOptions } from './index';

// String escaping
export { escapeString, escapeForMigration } from './index';
export { backtickQuote, quoteObjectKey } from './index';

// Utility functions
export { exhaustive } from './index';

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
} from './index';

// Default privileges
export { getSupportedDefaultPrivileges, type DefaultPrivileges } from './index';

// Computed columns
export {
  type ComputedColumnsFromOptions,
  type ComputedOptionsConfig,
  type ComputedOptionsFactory,
} from './index';

// NoPrimaryKeyOption
export { type NoPrimaryKeyOption } from './index';

// _initQueryBuilder and DbResult
export { _initQueryBuilder, type DbResult, type DbOptions } from './index';

// AsyncState
export { type AsyncState, type SqlSessionState } from './index';

// Column utilities
export { type DbStructureDomainsMap, getColumnBaseType } from './index';

// Column from db utilities
export { assignDbDataToColumn, type ColumnFromDbParams } from './index';

// Columns by type
export { makeColumnsByType, type ColumnsByType } from './index';

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
} from './index';

// Query data utilities
export {
  pushQueryValueImmutable,
  getClonedQueryData,
  type JoinedShapes,
} from './index';

// Upsert types
export { type UpsertData, type UpsertThis } from './index';

// Column name management (for migrations)
export {
  setCurrentColumnName,
  consumeColumnName,
  setDefaultLanguage,
} from './index';

// Unknown column (for raw SQL)
export { UnknownColumn } from './index';

// Transaction
export { type IsolationLevel, type TransactionOptions } from './index';
