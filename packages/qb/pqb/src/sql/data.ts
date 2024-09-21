import { PickQueryQ, Query } from '../query/query';
import { Adapter, QueryResult } from '../adapter';
import { toSQLCacheKey } from './toSQL';
import {
  HavingItem,
  JoinItem,
  OnConflictTarget,
  OnConflictSet,
  OrderItem,
  QuerySourceItem,
  SelectItem,
  UnionItem,
  WhereItem,
  WindowItem,
  WithItem,
  OnConflictMerge,
} from './types';
import { SelectableOrExpression } from '../common/utils';
import {
  ColumnsShapeBase,
  MaybeArray,
  Sql,
  ColumnsParsers,
  Expression,
  QueryColumn,
  RecordString,
  RecordUnknown,
  QueryReturnType,
  PickQueryTable,
  ExpressionChain,
  QueryDataTransform,
  HookSelect,
  BatchParsers,
  MaybePromise,
  QueryLogger,
  QueryLogObject,
} from 'orchid-core';
import { RelationQuery } from '../relations';

import { ComputedColumns } from '../modules/computed';
import { AfterCommitError } from '../queryMethods';

export interface RecordOfColumnsShapeBase {
  [K: string]: ColumnsShapeBase;
}

export interface WithConfigs {
  [K: string]: {
    shape: ColumnsShapeBase;
    computeds?: ComputedColumns;
  };
}

// Column shapes of joined tables. Used to select, filter, order by the columns of joined tables.
export type JoinedShapes = RecordOfColumnsShapeBase;

// Column parsers of joined tables. Used to parse the columns when selecting the column of joined tables.
export interface JoinedParsers {
  [K: string]: ColumnsParsers;
}
// Keep track of joined table names.
// When joining the same table second time, this allows to add a numeric suffix to avoid name collisions.
export type JoinOverrides = RecordString;

export type QueryBeforeHook = (query: Query) => void | Promise<void>;
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
    isSubQuery?: true,
  ): MaybePromise<unknown>;
}

export interface CommonQueryData {
  adapter: Adapter;
  shape: ColumnsShapeBase;
  patchResult?(q: Query, queryResult: QueryResult): Promise<void>;
  handleResult: HandleResult;
  returnType: QueryReturnType;
  wrapInTransaction?: boolean;
  throwOnNotFound?: boolean;
  with?: WithItem[];
  withShapes?: WithConfigs;
  joinTo?: QueryDataJoinTo;
  joinedShapes?: JoinedShapes;
  joinedParsers?: JoinedParsers;
  joinedBatchParsers?: { [K: string]: BatchParsers };
  joinedComputeds?: { [K: string]: ComputedColumns };
  joinedForSelect?: string;
  innerJoinLateral?: true;
  // to implicitly alias joined tables so there can be a "user" on top and a nested joined "user", the nested user is internally aliased as "user2".
  joinOverrides?: JoinOverrides;
  // stores `joinOverrides` of the parent query object when the current query object is withing a query callback.
  outerJoinOverrides?: JoinOverrides;
  schema?: string;
  select?: SelectItem[];
  selectAllColumns?: string[];
  selectAllKeys?: RecordUnknown;
  /**
   * column type for query with 'value' or 'valueOrThrow' return type
   * Is needed in {@link getShapeFromSelect} to get shape of sub-select that returns a single value.
   */
  getColumn?: QueryColumn;
  // expr when a single value is returned from the query, when using `get`, or functions.
  expr?: Expression;
  as?: string;
  aliases?: RecordString;
  from?: MaybeArray<QueryDataFromItem>;
  sources?: { [K: string]: QuerySourceItem };
  and?: WhereItem[];
  or?: WhereItem[][];
  coalesceValue?: unknown | Expression;
  parsers?: ColumnsParsers;
  batchParsers?: BatchParsers;
  notFoundDefault?: unknown;
  defaults?: RecordUnknown;
  // for runtime computed dependencies
  hookSelect?: HookSelect;
  // available computed columns, can be set when selecting from a `with` expression
  computeds?: ComputedColumns;
  // selected computed columns
  selectedComputeds?: ComputedColumns;
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
  // run functions before delete
  beforeDelete?: QueryBeforeHook[];
  // run functions after delete in transaction
  afterDelete?: QueryAfterHook[];
  // run functions after delete commit
  afterDeleteCommit?: QueryAfterHook[];
  // additional select for afterDelete hooks
  afterDeleteSelect?: Set<string>;
  // catch after commit hooks errors, letting query to return its result
  catchAfterCommitError?(error: AfterCommitError): void;
  // log settings
  log?: QueryLogObject;
  // logger with `log`, `warn`, `error`
  logger: QueryLogger;
  // convert query into prepared statement automatically as an optimization
  autoPreparedStatements?: boolean;
  // cache `toSQL` output
  [toSQLCacheKey]?: Sql;
  // functions to transform query result after loading data
  transform?: QueryDataTransform[];
  // default language for the full text search
  language?: string;
  // Is set for query arg inside `select`, `where`, and others callbacks.
  // It is used by ORM to skip applying a join to the query when `subQuery` is true,
  // the join will be applied after callback is resolved.
  // 1 for the same query, 2 for relation queries returned from the callback.
  subQuery?: number;
  // Chained relations, such as `db.user.messages.chat` are stored into array.
  relChain?: (Query | RelationQuery)[];
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
}

export interface SelectQueryData extends CommonQueryData {
  type: undefined;
  distinct?: SelectableOrExpression[];
  only?: boolean;
  join?: JoinItem[];
  group?: (string | Expression)[];
  having?: HavingItem[];
  window?: WindowItem[];
  union?: { b: Query; u: UnionItem[] };
  order?: OrderItem[];
  returnsOne?: true;
  limit?: number;
  offset?: number;
  for?: {
    type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
    tableNames?: string[] | Expression;
    mode?: 'NO WAIT' | 'SKIP LOCKED';
  };
}

export type CreateKind = 'object' | 'raw' | 'from';

export interface InsertQueryData extends CommonQueryData {
  type: 'insert';
  kind: CreateKind;
  columns: string[];
  values:
    | unknown[][]
    | MaybeArray<Expression>
    | {
        from: Query;
        values?: unknown[][];
      };
  using?: JoinItem[];
  join?: JoinItem[];
  onConflict?: {
    target?: OnConflictTarget;
    set?: OnConflictSet;
    merge?: OnConflictMerge;
  };
}

export interface UpdateQueryDataObject {
  [K: string]: Expression | { op: string; arg: unknown } | unknown;
}

export interface UpdatedAtDataInjector {
  (data: UpdateQueryDataItem[]): UpdateQueryDataItem | void;
}

export type UpdateQueryDataItem =
  | UpdateQueryDataObject
  | Expression
  | UpdatedAtDataInjector;

export interface UpdateQueryData extends CommonQueryData {
  type: 'update';
  updateData: UpdateQueryDataItem[];
}

export interface DeleteQueryData extends CommonQueryData {
  type: 'delete';
  join?: JoinItem[];
}

export interface TruncateQueryData extends CommonQueryData {
  type: 'truncate';
  restartIdentity?: boolean;
  cascade?: boolean;
}

export interface ColumnInfoQueryData extends CommonQueryData {
  type: 'columnInfo';
  column?: string;
}

export interface CopyQueryData extends CommonQueryData {
  type: 'copy';
  copy: CopyOptions;
}

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

export type QueryData =
  | SelectQueryData
  | InsertQueryData
  | UpdateQueryData
  | DeleteQueryData
  | TruncateQueryData
  | ColumnInfoQueryData
  | CopyQueryData;

export interface PickQueryDataShapeAndJoinedShapes {
  shape: ColumnsShapeBase;
  joinedShapes?: JoinedShapes;
}

// TODO: what if destructure when setting instead of when cloning?
export const cloneQuery = (q: QueryData) => {
  if (q.with) q.with = q.with.slice(0);
  if (q.select) q.select = q.select.slice(0);
  if (q.hookSelect) q.hookSelect = new Map(q.hookSelect);
  if (q.and) q.and = q.and.slice(0);
  if (q.or) q.or = q.or.slice(0);
  if (q.before) q.before = q.before.slice(0);
  if (q.after) q.after = q.after.slice(0);
  if (q.joinedShapes) q.joinedShapes = { ...q.joinedShapes };
  if (q.joinedComputeds) q.joinedComputeds = { ...q.joinedComputeds };
  if (q.batchParsers) q.batchParsers = [...q.batchParsers];
  if (q.joinedBatchParsers) q.joinedBatchParsers = { ...q.joinedBatchParsers };
  if (q.scopes) q.scopes = { ...q.scopes };
  if (q.parsers) q.parsers = { ...q.parsers };

  // may have data for updating timestamps on any kind of query
  if ((q as UpdateQueryData).updateData) {
    (q as UpdateQueryData).updateData = (q as UpdateQueryData).updateData.slice(
      0,
    );
  }

  if (q.type === undefined) {
    if (q.distinct) q.distinct = q.distinct.slice(0);
    if (q.join) q.join = q.join.slice(0);
    if (q.group) q.group = q.group.slice(0);
    if (q.having) q.having = q.having.slice(0);
    if (q.window) q.window = q.window.slice(0);
    if (q.union) q.union = { b: q.union.b, u: q.union.u.slice(0) };
    if (q.order) q.order = q.order.slice(0);
  } else if (q.type === 'insert') {
    q.columns = q.columns.slice(0);
    q.values = Array.isArray(q.values) ? q.values.slice(0) : q.values;
    if (q.using) q.using = q.using.slice(0);
    if (q.join) q.join = q.join.slice(0);
    if (q.beforeCreate) q.beforeCreate = q.beforeCreate.slice(0);
    if (q.afterCreate) {
      q.afterCreate = q.afterCreate.slice(0);
      if (q.afterCreateSelect) {
        q.afterCreateSelect = new Set(q.afterCreateSelect);
      }
    }
  } else if (q.type === 'update') {
    if (q.beforeUpdate) q.beforeUpdate = q.beforeUpdate.slice(0);
    if (q.afterUpdate) {
      q.afterUpdate = q.afterUpdate.slice(0);
      if (q.afterUpdateSelect) {
        q.afterUpdateSelect = new Set(q.afterUpdateSelect);
      }
    }
  } else if (q.type === 'delete') {
    if (q.beforeDelete) q.beforeDelete = q.beforeDelete.slice(0);
    if (q.afterDelete) {
      q.afterDelete = q.afterDelete.slice(0);
      if (q.afterDeleteSelect) {
        q.afterDeleteSelect = new Set(q.afterDeleteSelect);
      }
    }
  }
};
