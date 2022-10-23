import {
  ColumnsParsers,
  Query,
  QueryBase,
  QueryReturnType,
  QueryWithTable,
  SelectableBase,
} from '../query';
import { Expression, RawExpression } from '../common';
import { ColumnsShape, ColumnType } from '../columnSchema';
import { RelationQuery, relationQueryKey } from '../relations';
import { Adapter, QueryResult } from '../adapter';
import { MaybeArray } from '../utils';
import { QueryLogger, QueryLogObject } from '../queryMethods/log';
import { AfterCallback, BeforeCallback } from '../queryMethods/callbacks';

export type Sql = {
  text: string;
  values: unknown[];
};

// used in `from` logic to decide if convert query to sql or just write table name
export const queryKeysOfNotSimpleQuery: (keyof SelectQueryData)[] = [
  'take',
  'with',
  'as',
  'from',
  'and',
  'or',
  'select',
  'distinct',
  'fromOnly',
  'join',
  'group',
  'having',
  'havingOr',
  'window',
  'union',
  'order',
  'limit',
  'offset',
  'for',
];

export type CommonQueryData = {
  adapter: Adapter;
  handleResult(q: Query, result: QueryResult): Promise<unknown>;
  returnType: QueryReturnType;
  [relationQueryKey]?: string;
  inTransaction?: boolean;
  wrapInTransaction?: boolean;
  throwOnNotFound?: boolean;
  take?: boolean;
  with?: WithItem[];
  withShapes?: Record<string, ColumnsShape>;
  schema?: string;
  select?: SelectItem[];
  as?: string;
  from?: string | Query | RawExpression;
  and?: WhereItem[];
  or?: WhereItem[][];
  coalesceValue?: unknown | RawExpression;
  parsers?: ColumnsParsers;
  notFoundDefault?: unknown;
  defaults?: Record<string, unknown>;
  beforeQuery?: BeforeCallback<Query>[];
  afterQuery?: AfterCallback<Query>[];
  log?: QueryLogObject;
  logger: QueryLogger;
};

export type SelectQueryData = CommonQueryData & {
  type: undefined;
  distinct?: Expression[];
  fromOnly?: boolean;
  join?: JoinItem[];
  joinedParsers?: Record<string, ColumnsParsers>;
  group?: (string | RawExpression)[];
  having?: HavingItem[];
  havingOr?: HavingItem[][];
  window?: WindowItem[];
  union?: { arg: UnionItem; kind: UnionKind; wrap?: boolean }[];
  order?: OrderItem[];
  limit?: number;
  offset?: number;
  for?: {
    type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
    tableNames?: string[] | RawExpression;
    mode?: 'NO WAIT' | 'SKIP LOCKED';
  };
};

export type InsertQueryData = CommonQueryData & {
  type: 'insert';
  columns: string[];
  values: unknown[][] | RawExpression;
  using?: JoinItem[];
  join?: JoinItem[];
  joinedParsers?: Record<string, ColumnsParsers>;
  onConflict?:
    | {
        type: 'ignore';
        expr?: OnConflictItem;
      }
    | {
        type: 'merge';
        expr?: OnConflictItem;
        update?: OnConflictMergeUpdate;
      };
  beforeInsert?: BeforeCallback<Query>[];
  afterInsert?: AfterCallback<Query>[];
};

export type UpdateQueryData = CommonQueryData & {
  type: 'update';
  data: (
    | Record<string, RawExpression | { op: string; arg: unknown } | unknown>
    | RawExpression
  )[];
  beforeUpdate?: BeforeCallback<Query>[];
  afterUpdate?: AfterCallback<Query>[];
};

export type DeleteQueryData = CommonQueryData & {
  type: 'delete';
  join?: JoinItem[];
  joinedParsers?: Record<string, ColumnsParsers>;
};

export type TruncateQueryData = CommonQueryData & {
  type: 'truncate';
  restartIdentity?: boolean;
  cascade?: boolean;
};

export type ColumnInfoQueryData = CommonQueryData & {
  type: 'columnInfo';
  column?: string;
};

export type QueryData =
  | SelectQueryData
  | InsertQueryData
  | UpdateQueryData
  | DeleteQueryData
  | TruncateQueryData
  | ColumnInfoQueryData;

export type WithItem = [
  as: string,
  options: WithOptions,
  query: Query | RawExpression,
];

export type WithOptions = {
  columns?: string[];
  recursive?: true;
  materialized?: true;
  notMaterialized?: true;
};

export type JsonItem<
  As extends string = string,
  Type extends ColumnType = ColumnType,
> = {
  __json:
    | [
        kind: 'set',
        as: As,
        type: Type,
        column: string | JsonItem,
        path: Array<string | number>,
        value: unknown,
        options?: {
          createIfMissing?: boolean;
        },
      ]
    | [
        kind: 'insert',
        as: As,
        type: Type,
        column: string | JsonItem,
        path: Array<string | number>,
        value: unknown,
        options?: {
          insertAfter?: boolean;
        },
      ]
    | [
        kind: 'remove',
        as: As,
        type: Type,
        column: string | JsonItem,
        path: Array<string | number>,
      ]
    | [
        kind: 'pathQuery',
        as: As,
        type: Type,
        column: string | JsonItem,
        path: string,
        options?: {
          vars?: string;
          silent?: boolean;
        },
      ];
};

export type SelectItem =
  | string
  | RelationQuery
  | AggregateItem
  | { selectAs: Record<string, string | Query | RawExpression> }
  | SelectFunctionItem
  | JsonItem
  | RawExpression;

export type SelectFunctionItem = {
  function: string;
  arguments: SelectItem[];
  as?: string;
};

export type JoinItem = {
  type: string;
  args:
    | [relation: string]
    | [
        arg: string | QueryWithTable,
        conditions:
          | Record<string, string | RawExpression>
          | RawExpression
          | ((q: unknown) => QueryBase),
      ]
    | [
        arg: string | QueryWithTable,
        leftColumn: string | RawExpression,
        rightColumn: string | RawExpression,
      ]
    | [
        arg: string | QueryWithTable,
        leftColumn: string | RawExpression,
        op: string,
        rightColumn: string | RawExpression,
      ];
};

export type WhereItem =
  | (Omit<
      Record<
        string,
        | unknown
        | Record<string, unknown | Query | RawExpression>
        | RawExpression
      >,
      'NOT' | 'AND' | 'OR' | 'IN' | 'EXISTS' | 'ON' | 'ON_JSON_PATH_EQUALS'
    > & {
      NOT?: MaybeArray<WhereItem>;
      AND?: MaybeArray<WhereItem>;
      OR?: MaybeArray<WhereItem>[];
      IN?: MaybeArray<WhereInItem>;
      EXISTS?: MaybeArray<JoinItem['args']>;
      ON?: WhereOnItem | WhereJsonPathEqualsItem;
    })
  | ((q: unknown) => QueryBase)
  | Query
  | RawExpression;

export type WhereInItem = {
  columns: string[];
  values: unknown[][] | Query | RawExpression;
};

export type WhereJsonPathEqualsItem = [
  leftColumn: string,
  leftPath: string,
  rightColumn: string,
  rightPath: string,
];

export type WhereOnItem = {
  joinFrom: WhereOnJoinItem;
  joinTo: WhereOnJoinItem;
  on:
    | [leftFullColumn: string, rightFullColumn: string]
    | [leftFullColumn: string, op: string, rightFullColumn: string];
};

export type WhereOnJoinItem =
  | { table?: string; query: { as?: string } }
  | string;

export type AggregateItemOptions = {
  as?: string;
  distinct?: boolean;
  order?: OrderItem[];
  filter?: WhereItem;
  filterOr?: WhereItem[];
  withinGroup?: boolean;
  over?: string;
  window?: WindowItem;
};

export type SortDir = 'ASC' | 'DESC';

export type OrderItem =
  | string
  | Record<string, SortDir | { dir: SortDir; nulls: 'FIRST' | 'LAST' }>
  | RawExpression;

export type AggregateItemArg =
  | Expression
  | Record<string, Expression>
  | [Expression, string];

export type AggregateItem = {
  function: string;
  arg?: AggregateItemArg;
  options: AggregateItemOptions;
};

export type ColumnOperators<
  S extends SelectableBase,
  Column extends keyof S,
> = {
  [O in keyof S[Column]['column']['operators']]?:
    | S[Column]['column']['operators'][O]['type'];
};

type HavingItemObject = Record<string, unknown>;

export type HavingItem =
  | Record<string, HavingItemObject>
  | { count?: number | HavingItemObject }
  | Query
  | RawExpression;

export type WindowItem = Record<string, WindowDeclaration | RawExpression>;

export type WindowDeclaration = {
  partitionBy?: Expression | Expression[];
  order?: OrderItem;
};

export type UnionItem = Query | RawExpression;

type UnionKind =
  | 'UNION'
  | 'UNION ALL'
  | 'INTERSECT'
  | 'INTERSECT ALL'
  | 'EXCEPT'
  | 'EXCEPT ALL';

export type OnConflictItem = string | string[] | RawExpression;

export type OnConflictMergeUpdate =
  | string
  | string[]
  | Record<string, unknown>
  | RawExpression;
