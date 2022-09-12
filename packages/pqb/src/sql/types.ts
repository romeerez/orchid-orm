import {
  ColumnsParsers,
  Query,
  QueryWithTable,
  SelectableBase,
} from '../query';
import { Expression, RawExpression } from '../common';
import { ColumnsShape, ColumnType } from '../columnSchema';
import { RelationQuery, relationQueryKey } from '../relations';
import { PostgresAdapter } from '../adapter';

export type Sql = {
  text: string;
  values: unknown[];
};

export type CommonQueryData = {
  adapter: PostgresAdapter;
  [relationQueryKey]?: true;
  inTransaction?: true;
  wrapInTransaction?: true;
  take?: true;
  with?: WithItem[];
  withShapes?: Record<string, ColumnsShape>;
  schema?: string;
  as?: string;
  from?: string | Query | RawExpression;
  and?: WhereItemContainer[];
  or?: WhereItemContainer[][];
  parsers?: ColumnsParsers;
  defaults?: Record<string, unknown>;
  beforeQuery?: ((q: Query) => void | Promise<void>)[];
  afterQuery?: ((q: Query, data: unknown) => void | Promise<void>)[];
};

export type SelectQueryData = CommonQueryData & {
  type: undefined;
  select?: SelectItem[];
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
  returning?: (string[] | '*')[];
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
  beforeInsert?: CommonQueryData['beforeQuery'];
  afterInsert?: CommonQueryData['afterQuery'];
};

export type UpdateQueryData = CommonQueryData & {
  type: 'update';
  data: (
    | Record<string, RawExpression | { op: string; arg: unknown } | unknown>
    | RawExpression
  )[];
  returning?: (string[] | '*')[];
};

export type DeleteQueryData = CommonQueryData & {
  type: 'delete';
  returning?: (string[] | '*')[];
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
  | { function: string; arguments: SelectItem[]; as?: string }
  | JsonItem
  | RawExpression;

export type JoinItem = {
  type: string;
  args:
    | [relation: string]
    | [
        relation: string,
        conditions: { type: 'query'; query: { query: QueryData } },
      ]
    | [
        withOrQuery: string | QueryWithTable,
        objectOrRawOrJoinQuery:
          | {
              type: 'objectOrRaw';
              data: Record<string, string | RawExpression> | RawExpression;
            }
          | {
              type: 'query';
              query: { query: QueryData };
            },
      ]
    | [
        withOrQuery: string | QueryWithTable,
        leftColumn: string | RawExpression,
        rightColumn: string | RawExpression,
      ]
    | [
        withOrQuery: string | QueryWithTable,
        leftColumn: string | RawExpression,
        op: string,
        rightColumn: string | RawExpression,
      ];
};

export type WhereItemContainer = {
  item: WhereItem;
  not?: boolean;
};

export type WhereItem =
  | {
      type: 'object';
      data:
        | Record<
            string,
            | unknown
            | Record<string, unknown | Query | RawExpression>
            | RawExpression
          >
        | Query
        | RawExpression;
    }
  | {
      type: 'nested';
      and?: WhereItemContainer[];
      or?: WhereItemContainer[][];
    }
  | {
      type: 'in';
      columns: string[];
      values: unknown[][] | Query | RawExpression;
    }
  | {
      type: 'notIn';
      columns: string[];
      values: unknown[][] | Query | RawExpression;
    }
  | {
      type: 'exists';
      args: JoinItem['args'];
    }
  | {
      type: 'on';
      joinFrom: { table?: string; query: { as?: string } } | string;
      joinTo: { table?: string; query: { as?: string } } | string;
      on:
        | [leftFullColumn: string, rightFullColumn: string]
        | [leftFullColumn: string, op: string, rightFullColumn: string];
    }
  | {
      type: 'onJsonPathEquals';
      data: [
        leftColumn: string,
        leftPath: string,
        rightColumn: string,
        rightPath: string,
      ];
    };

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
