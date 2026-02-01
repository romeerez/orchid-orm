import { IsQuery, Query, QueryReturnType } from './query';
import { ComputedColumns } from './extra-features/computed/computed';
import { Column } from '../columns/column';
import { ColumnsShape } from '../columns/columns-shape';
import { CteItem } from './basic-features/cte/cte.sql';
import {
  HasBeforeAndBeforeSet,
  SubQueryForSql,
} from './sub-query/sub-query-for-sql';
import {
  BatchParsers,
  ColumnsParsers,
  PickQueryDataParsers,
} from './query-columns/query-column-parsers';
import {
  PickQueryInputType,
  PickQueryQ,
  PickQueryTable,
} from './pick-query-types';
import {
  Expression,
  ExpressionChain,
  SelectableOrExpression,
} from './expressions/expression';
import { AdapterBase, QueryResult } from '../adapters/adapter';
import { HasHookSelect } from './basic-features/select/hook-select';
import {
  MaybeArray,
  pushOrNewArrayToObjectImmutable,
  RecordString,
  RecordUnknown,
} from '../utils';
import { RelationConfigBase } from './relations';
import { QueryDataAliases } from './basic-features/as/as';
import { AfterCommitErrorHandler } from './basic-features/transaction/transaction';
import { Sql } from './sql/sql';
import { QueryDataTransform } from './extra-features/data-transform/transform';
import { QueryHookUtils } from './extra-features/hooks/hooks';
import { SelectItem } from './basic-features/select/select.sql';
import { QueryDataSources } from './extra-features/search/search.sql';
import { JoinItem, JoinItemArgs } from './basic-features/join/join.sql';
import { WhereItem } from './basic-features/where/where.sql';
import { OrderItem } from './basic-features/order/order.sql';
import { HavingItem } from './basic-features/having/having.sql';
import { WindowItem } from './basic-features/window/window.sql';
import { QueryDataUnion } from './basic-features/union/union.sql';
import {
  OnConflictMerge,
  OnConflictSet,
  OnConflictTarget,
} from './basic-features/mutate/insert.sql';
import { QueryLogger, QueryLogObject } from './basic-features/log/log';
import { QuerySchema } from './basic-features/schema/schema';

export interface RecordOfColumnsShapeBase {
  [K: string]: Column.Shape.QueryInit;
}

export interface WithConfigs {
  [K: string]: WithConfig;
}

export interface WithConfig {
  shape: Column.Shape.QueryInit;
  computeds?: ComputedColumns;
}

// Column shapes of joined tables. Used to select, filter, order by the columns of joined tables.
export type JoinedShapes = RecordOfColumnsShapeBase;

// Column parsers of joined tables. Used to parse the columns when selecting the column of joined tables.
export interface JoinedParsers {
  [K: string]: ColumnsParsers | undefined;
}

export type QueryBeforeHook = (query: Query) => void | Promise<void>;

export type QueryBeforeActionHook = (
  utils: QueryHookUtils<PickQueryInputType>,
) => void | Promise<void>;

export type QueryAfterHook<Data = unknown> = (
  data: Data,
  query: Query,
) => unknown | Promise<unknown>;

export interface QueryDataScopes {
  [K: string]: QueryScopeData;
}

// Query data stored for a specific scope to be applied to the query.
export interface QueryScopeData {
  and?: WhereItem[];
  or?: WhereItem[][];
}

export type QueryDataFromItem = string | SubQueryForSql | Expression;

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

export interface JoinValueDedupItem {
  q: Query;
  a: string;
}

export type QueryType =
  | undefined
  // the same as undefined, used only in SQL composer to override default value
  | null
  | 'upsert'
  | 'insert'
  | 'update'
  | 'delete';

export interface AsFn {
  (as: string): void;
}

export interface QueryData
  extends QueryDataAliases,
    PickQueryDataParsers,
    HasHookSelect {
  type: QueryType;
  adapter: AdapterBase;
  shape: ColumnsShape;
  handleResult: HandleResult;
  // When executed in a transaction,
  // the query will be wrapped with a `SAVEPOINT x; *query*; ROLLBACK TO SAVEPOINT x (if fails)`.
  // This allows to continue working with the transaction, otherwise it would be in a failed state and wouldn't accept more queries.
  catch?: boolean;
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
  // to select values with `get` or aggregate them when they were joined inside `select`.
  // joined table name is implicit in such a case.
  valuesJoinedAs?: RecordString;
  schema?: QuerySchema;
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
  getColumn?: Column.Pick.QueryColumn;
  // expr when a single value is returned from the query, when using `get`, or functions.
  expr?: Expression;
  from?: MaybeArray<QueryDataFromItem>;
  updateFrom?: JoinItemArgs;
  sources?: QueryDataSources;
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
  // a set for deduplication of hooks added dynamically from the sub queries
  beforeSet?: Set<QueryBeforeHook>;
  // regular before are executed before SQL is generated,
  // but in some cases (dynamic aka lazy SQL) this is impossible,
  // such queries need a second round of `before` hooks to execute after SQL generation.
  dynamicBefore?: HasBeforeAndBeforeSet[];
  // run functions before any query
  before?: QueryBeforeHook[];
  // run functions after any query
  after?: QueryAfterHook[];
  // run functions before create
  beforeCreate?: QueryBeforeHook[];
  // run functions after create in transaction
  afterCreate?: QueryAfterHook[];
  // run functions after create commit
  afterCreateCommit?: QueryAfterHook[];
  // additional select for afterCreate hooks
  afterCreateSelect?: Set<string>;
  // run functions before update
  beforeUpdate?: QueryBeforeHook[];
  // run functions after update in transaction
  afterUpdate?: QueryAfterHook[];
  // run functions after update commit
  afterUpdateCommit?: QueryAfterHook[];
  // additional select for afterUpdate hooks
  afterUpdateSelect?: Set<string>;
  // run functions after create or update in transaction
  afterSave?: QueryAfterHook[];
  // run functions after create or update commit
  afterSaveCommit?: QueryAfterHook[];
  // additional select for afterSave hooks
  afterSaveSelect?: Set<string>;
  // run functions before delete
  beforeDelete?: QueryBeforeHook[];
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

  // It is used by `joinQueryChainHOF` to customize the outer query of a chained relation.
  outerQuery?: Query;

  // `set` data for insert or update that was set from a `before*` hook
  hookCreateSet?: RecordUnknown[];
  hookUpdateSet?: RecordUnknown[];

  appendQueries?: SubQueryForSql[];
  asFns?: AsFn[];

  /** select and upsert **/

  distinct?: SelectableOrExpression[];
  only?: boolean;
  join?: JoinItem[];
  joinValueDedup?: Map<string, JoinValueDedupItem>;
  group?: (string | Expression)[];
  having?: HavingItem[];
  window?: WindowItem[];
  union?: QueryDataUnion;
  limit?: number;
  offset?: number;
  for?: {
    type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
    tableNames?: string[] | Expression;
    mode?: 'NO WAIT' | 'SKIP LOCKED';
  };

  /** upsert **/

  // upsert does 2 queries: simple find/update, then a union of find/update and insert.
  // this signals SQL code to run the second query for the same query object.
  upsertUpdate?: boolean;
  upsertSecond?: boolean;

  /** insert **/

  columns: string[];
  insertFrom?: SubQueryForSql;
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
}

export type InsertQueryDataObjectValues = unknown[][];

export interface UpdateQueryDataObject {
  [K: string]: Expression | { op: string; arg: unknown } | unknown;
}

export interface UpdatedAtDataInjector {
  (data: UpdateQueryDataItem[]): UpdateQueryDataObject | void;
}

export type UpdateQueryDataItem = UpdateQueryDataObject | UpdatedAtDataInjector;

export interface PickQueryDataShapeAndJoinedShapes {
  shape: Column.Shape.QueryInit;
  joinedShapes?: JoinedShapes;
}

export interface PickQueryDataShapeAndJoinedShapesAndAliases
  extends PickQueryDataShapeAndJoinedShapes,
    QueryDataAliases {}

/**
 * Push a new element into an array in the query data - immutable version
 *
 * @param q - query
 * @param key - key to get the array
 * @param value - new element to push
 */
export const pushQueryValueImmutable = <T extends IsQuery>(
  q: T,
  key: string,
  value: unknown,
): T => {
  pushOrNewArrayToObjectImmutable(
    (q as unknown as { q: object }).q,
    key,
    value,
  );
  return q;
};

export const getClonedQueryData = (query: QueryData): QueryData => {
  return { ...query };
};
