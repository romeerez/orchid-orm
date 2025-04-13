import { PickQueryQ, Query } from '../query/query';
import { Adapter, QueryResult } from '../adapter';
import {
  HavingItem,
  JoinItem,
  OnConflictMerge,
  OnConflictSet,
  OnConflictTarget,
  OrderItem,
  QuerySourceItem,
  SelectItem,
  UnionItem,
  WhereItem,
  WindowItem,
  WithItem,
} from './types';
import { SelectableOrExpression } from '../common/utils';
import {
  BatchParsers,
  ColumnsParsers,
  ColumnsShapeBase,
  Expression,
  ExpressionChain,
  HookSelect,
  MaybeArray,
  MaybePromise,
  PickQueryTable,
  QueryColumn,
  QueryDataTransform,
  QueryLogger,
  QueryLogObject,
  QueryReturnType,
  RecordString,
  RecordUnknown,
} from 'orchid-core';
import { RelationQueryBase } from '../relations';

import { ComputedColumns } from '../modules/computed';
import { AfterCommitError } from '../queryMethods';
import { ColumnsShape } from '../columns';

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
  [K: string]: ColumnsParsers | undefined;
}

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
  with?: WithItem[];
  withShapes?: WithConfigs;
  joinTo?: QueryDataJoinTo;
  joinedShapes?: JoinedShapes;
  joinedParsers?: JoinedParsers;
  joinedBatchParsers?: { [K: string]: BatchParsers };
  joinedComputeds?: { [K: string]: ComputedColumns | undefined };
  joinedForSelect?: string;
  innerJoinLateral?: true;
  // stores `aliases` of the parent query object when the current query object is withing a query callback.
  outerAliases?: RecordString;
  schema?: string;
  select?: SelectItem[];
  selectCache?: { sql: string; aliases: string[] };
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
  // available computed columns, this can be set when selecting from a `with` expression
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
  relChain?: (Query | RelationQueryBase)[];
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
    returning?: { select?: string; hookSelect?: HookSelect };
    targetHookSelect: HookSelect;
  };
}

export interface SelectQueryData extends CommonQueryData {
  type: undefined | 'upsert';
  distinct?: SelectableOrExpression[];
  only?: boolean;
  join?: JoinItem[];
  group?: (string | Expression)[];
  having?: HavingItem[];
  window?: WindowItem[];
  union?: {
    b: Query;
    u: UnionItem[];
    // true to not wrap the first union query into parens.
    p?: boolean;
  };
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
