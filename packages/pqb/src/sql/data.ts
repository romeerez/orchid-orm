import { PickQueryQ, Query } from '../query/query';
import {
  HavingItem,
  JoinItem,
  JoinItemArgs,
  OnConflictMerge,
  OnConflictSet,
  OnConflictTarget,
  OrderItem,
  QuerySourceItem,
  SelectItem,
  UnionItem,
  WhereItem,
  WindowItem,
} from './types';
import { SelectableOrExpression } from '../common/utils';
import {
  AdapterBase,
  BatchParsers,
  ColumnsParsers,
  ColumnsShapeBase,
  DelayedRelationSelect,
  Expression,
  ExpressionChain,
  HookSelect,
  MaybeArray,
  PickQueryInputType,
  PickQueryTable,
  QueryColumn,
  QueryDataAliases,
  QueryDataBase,
  QueryDataTransform,
  QueryHookUtils,
  QueryLogger,
  QueryLogObject,
  QueryResult,
  QueryReturnType,
  RecordUnknown,
  RelationConfigBase,
  Sql,
} from '../core';
import { ComputedColumns } from '../modules/computed';
import { AfterCommitErrorHandler } from '../queryMethods';
import { ColumnsShape } from '../columns';
import { CteItem } from '../query/cte/cte.sql';

export interface RecordOfColumnsShapeBase {
  [K: string]: ColumnsShapeBase;
}

export interface WithConfigs {
  [K: string]: WithConfig;
}

export interface WithConfig {
  shape: ColumnsShapeBase;
  computeds?: ComputedColumns;
}

// Column shapes of joined tables. Used to select, filter, order by the columns of joined tables.
export type JoinedShapes = RecordOfColumnsShapeBase;

// Column parsers of joined tables. Used to parse the columns when selecting the column of joined tables.
export interface JoinedParsers {
  [K: string]: ColumnsParsers | undefined;
}

export type QueryBeforeHookInternal = (query: Query) => void | Promise<void>;

export type QueryBeforeHook = (
  utils: QueryHookUtils<PickQueryInputType>,
) => void | Promise<void>;

export type QueryAfterHook<Data = unknown> = (
  data: Data,
  query: Query,
) => unknown | Promise<unknown>;

export interface QueryScopes {
  [K: string]: QueryScopeData;
}

// Query data stored for a specific scope to be applied to the query.
export interface QueryScopeData {
  and?: WhereItem[];
  or?: WhereItem[][];
}

export type QueryDataFromItem = string | Query | Expression;

export interface QueryDataJoinTo extends PickQueryTable, PickQueryQ {}

export interface HandleResult {
  (
    q: Query,
    returnType: QueryReturnType,
    result: QueryResult,
    sql: Sql,
    isSubQuery?: true,
  ): unknown;
}

export type WithItems = CteItem[];

export interface QueryData extends QueryDataBase {
  type:
    | undefined
    | 'upsert'
    | 'insert'
    | 'update'
    | 'delete'
    | 'truncate'
    | 'columnInfo'
    | 'copy';
  adapter: AdapterBase;
  shape: ColumnsShape;
  patchResult?(
    q: Query,
    hookSelect: HookSelect | undefined,
    queryResult: QueryResult,
  ): Promise<void>;
  handleResult: HandleResult;
  returnType: QueryReturnType;
  returning?: boolean;
  returningMany?: boolean;
  wrapInTransaction?: boolean;
  throwOnNotFound?: boolean;
  with?: WithItems;
  withShapes?: WithConfigs;
  joinTo?: QueryDataJoinTo;
  joinedShapes?: JoinedShapes;
  joinedParsers?: JoinedParsers;
  joinedBatchParsers?: { [K: string]: BatchParsers };
  joinedComputeds?: { [K: string]: ComputedColumns | undefined };
  joinedForSelect?: string;
  innerJoinLateral?: true;
  schema?: string;
  select?: SelectItem[];
  selectRelation?: boolean;
  selectCache?: { sql: string; aliases: string[] };
  selectAllColumns?: string[];
  /**
   * Subset of the `shape` that only includes columns with no `data.explicitSelect`.
   */
  selectAllShape: RecordUnknown;
  /**
   * column type for query with 'value' or 'valueOrThrow' return type
   * Is needed in {@link getShapeFromSelect} to get shape of sub-select that returns a single value.
   */
  getColumn?: QueryColumn;
  // expr when a single value is returned from the query, when using `get`, or functions.
  expr?: Expression;
  from?: MaybeArray<QueryDataFromItem>;
  updateFrom?: JoinItemArgs;
  sources?: { [K: string]: QuerySourceItem };
  and?: WhereItem[];
  or?: WhereItem[][];
  order?: OrderItem[];
  // It is used for ORM relations that are known to return a single record to omit `LIMIT` and `OFFSET` from SQL.
  returnsOne?: true;
  // It is used by `joinQueryChainHOF`
  // to remove `LIMIT` and `OFFSET`
  // from the inner query and apply it to the outer query for grouping-ordering reasons.
  useFromLimitOffset?: true;
  coalesceValue?: unknown | Expression;
  notFoundDefault?: unknown;
  defaults?: RecordUnknown;
  // available computed columns, this can be set when selecting from a `with` expression
  runtimeComputeds?: ComputedColumns;
  // selected computed columns
  selectedComputeds?: ComputedColumns;
  // run functions before any query
  before?: QueryBeforeHookInternal[];
  // run functions after any query
  after?: QueryAfterHook[];
  // run functions before create
  beforeCreate?: QueryBeforeHookInternal[];
  // run functions after create in transaction
  afterCreate?: QueryAfterHook[];
  // run functions after create commit
  afterCreateCommit?: QueryAfterHook[];
  // additional select for afterCreate hooks
  afterCreateSelect?: Set<string>;
  // run functions before update
  beforeUpdate?: QueryBeforeHookInternal[];
  // run functions after update in transaction
  afterUpdate?: QueryAfterHook[];
  // run functions after update commit
  afterUpdateCommit?: QueryAfterHook[];
  // additional select for afterUpdate hooks
  afterUpdateSelect?: Set<string>;
  // run functions before delete
  beforeDelete?: QueryBeforeHookInternal[];
  // run functions after delete in transaction
  afterDelete?: QueryAfterHook[];
  // run functions after delete commit
  afterDeleteCommit?: QueryAfterHook[];
  // additional select for afterDelete hooks
  afterDeleteSelect?: Set<string>;
  // catch after commit hooks errors, letting query to return its result
  catchAfterCommitErrors?: AfterCommitErrorHandler[];
  // log settings
  log?: QueryLogObject;
  // logger with `log`, `warn`, `error`
  logger: QueryLogger;
  // convert query into prepared statement automatically as an optimization
  autoPreparedStatements?: boolean;
  // functions to transform query result after loading data
  transform?: QueryDataTransform[];
  // default language for the full text search
  language?: string;
  // Is set for query arg inside `select`, `where`, and others callbacks.
  // It is used by ORM to skip applying a join to the query when `subQuery` is true,
  // the join will be applied after callback is resolved.
  // 1 for the same query, 2 for relation queries returned from the callback.
  subQuery?: number;
  // once there is a hasMany or hasAndBelongsToMany in the chain,
  // the following belongTo and hasOne must also return multiple
  chainMultiple?: boolean;
  // Chained relations, such as `db.user.messages.chat` are stored into array.
  relChain?: { query: Query; rel: RelationConfigBase }[];
  /**
   * Stores current operator functions available for the query.
   * Is needed to remove these operators from query object when changing the query type, see {@link setQueryOperators}.
   */
  operators?: RecordUnknown;
  // Track the applied scopes, this is used when removing the scope from the query.
  scopes?: { [K: string]: QueryScopeData };
  // to allow updating or deleting all records
  all?: true;

  chain?: ExpressionChain;

  inCTE?: {
    selectNum: boolean;
    returning?: {
      select?: string;
      hookSelect?: HookSelect;
    };
    targetHookSelect: HookSelect;
    delayedRelationSelect: DelayedRelationSelect;
  };

  // It is used by `joinQueryChainHOF` to customize the outer query of a chained relation.
  outerQuery?: Query;

  // `set` data for insert or update that was set from a `before*` hook
  hookCreateSet?: RecordUnknown[];
  hookUpdateSet?: RecordUnknown[];

  /** select and upsert **/

  distinct?: SelectableOrExpression[];
  only?: boolean;
  join?: JoinItem[];
  joinValueDedup?: Map<string, { q: Query; a: string }>;
  group?: (string | Expression)[];
  having?: HavingItem[];
  window?: WindowItem[];
  union?: {
    b: Query;
    u: UnionItem[];
    // true to not wrap the first union query into parens.
    p?: boolean;
  };
  limit?: number;
  offset?: number;
  for?: {
    type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
    tableNames?: string[] | Expression;
    mode?: 'NO WAIT' | 'SKIP LOCKED';
  };

  /** insert **/

  columns: string[];
  insertFrom?: Query;
  insertValuesAs?: string;
  queryColumnsCount?: number;
  values: InsertQueryDataObjectValues;
  onConflict?: {
    target?: OnConflictTarget;
    set?: OnConflictSet;
    merge?: OnConflictMerge;
  };

  /** update **/

  updateData: UpdateQueryDataItem[];

  /** truncate **/

  restartIdentity?: boolean;
  cascade?: boolean;

  /** column info **/

  column?: string;

  /** copy **/

  copy: CopyOptions;
}

export type InsertQueryDataObjectValues = unknown[][];

export interface UpdateQueryDataObject {
  [K: string]: Expression | { op: string; arg: unknown } | unknown;
}

export interface UpdatedAtDataInjector {
  (data: UpdateQueryDataItem[]): UpdateQueryDataObject | void;
}

export type UpdateQueryDataItem = UpdateQueryDataObject | UpdatedAtDataInjector;

export type CopyOptions<Column = string> = {
  columns?: Column[];
  format?: 'text' | 'csv' | 'binary';
  freeze?: boolean;
  delimiter?: string;
  null?: string;
  header?: boolean | 'match';
  quote?: string;
  escape?: string;
  forceQuote?: Column[] | '*';
  forceNotNull?: Column[];
  forceNull?: Column[];
  encoding?: string;
} & (
  | {
      from: string | { program: string };
    }
  | {
      to: string | { program: string };
    }
);

export interface PickQueryDataShapeAndJoinedShapes {
  shape: ColumnsShapeBase;
  joinedShapes?: JoinedShapes;
}

export interface PickQueryDataShapeAndJoinedShapesAndAliases
  extends PickQueryDataShapeAndJoinedShapes,
    QueryDataAliases {}
