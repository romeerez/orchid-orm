import { Query, QueryBase, QueryWithTable, SelectableBase } from '../query';
import { RawExpression } from '../raw';
import { ColumnType } from '../columns';
import { RelationQuery } from '../relations';
import { Expression, MaybeArray } from '../utils';
import { QueryData, SelectQueryData } from './data';

export type Sql = {
  text: string;
  values: unknown[];
};

// used in `from` logic to decide if convert query to sql or just write table name
export const checkIfASimpleQuery = (q: QueryData) => {
  if (q.returnType && q.returnType !== 'all') return false;
  const keys = Object.keys(q) as (keyof SelectQueryData)[];
  return !keys.some((key) => queryKeysOfNotSimpleQuery.includes(key));
};

const queryKeysOfNotSimpleQuery: (keyof SelectQueryData)[] = [
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

export type UnionKind =
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
