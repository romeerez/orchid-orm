import { Query, QueryWithTable, SelectableBase } from '../query';
import { RelationQuery } from '../relations';
import { SelectableOrExpression } from '../utils';
import { SelectQueryData } from './data';
import { ColumnTypeBase, Expression, MaybeArray } from 'orchid-core';
import { QueryBase } from '../queryBase';

// used in `from` logic to decide if convert query to sql or just write table name
export const checkIfASimpleQuery = (q: Query) => {
  if (
    (q.query.returnType && q.query.returnType !== 'all') ||
    q.internal.columnsForSelectAll ||
    q.query.and?.length ||
    q.query.or?.length
  )
    return false;

  const keys = Object.keys(q.query) as (keyof SelectQueryData)[];
  return !keys.some((key) => queryKeysOfNotSimpleQuery.includes(key));
};

const queryKeysOfNotSimpleQuery: (keyof SelectQueryData)[] = [
  'with',
  'as',
  'from',
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
  query: Query | Expression,
];

export type WithOptions = {
  columns?: string[];
  recursive?: true;
  materialized?: true;
  notMaterialized?: true;
};

export type JsonItem<
  As extends string = string,
  Type extends ColumnTypeBase = ColumnTypeBase,
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
  | { selectAs: Record<string, string | Query | Expression> }
  | SelectFunctionItem
  | JsonItem
  | Expression;

export type SelectFunctionItem = {
  function: string;
  arguments: SelectItem[];
  as?: string;
};

export type JoinItem = SimpleJoinItem | JoinLateralItem;

export type SimpleJoinItem = {
  type: string;
  args:
    | [relation: string]
    | [
        arg: string | QueryWithTable,
        conditions:
          | Record<string, string | Expression>
          | Expression
          | ((q: unknown) => QueryBase)
          | true,
      ]
    | [
        arg: string | QueryWithTable,
        leftColumn: string | Expression,
        rightColumn: string | Expression,
      ]
    | [
        arg: string | QueryWithTable,
        leftColumn: string | Expression,
        op: string,
        rightColumn: string | Expression,
      ];
  // available only for QueryWithTable as first argument
  isSubQuery: boolean;
};

export type JoinLateralItem = [type: string, joined: Query, as: string];

export type WhereItem =
  | (Omit<
      Record<
        string,
        unknown | Record<string, unknown | Query | Expression> | Expression
      >,
      'NOT' | 'AND' | 'OR' | 'IN' | 'EXISTS' | 'ON' | 'ON_JSON_PATH_EQUALS'
    > & {
      NOT?: MaybeArray<WhereItem>;
      AND?: MaybeArray<WhereItem>;
      OR?: MaybeArray<WhereItem>[];
      IN?: MaybeArray<WhereInItem>;
      EXISTS?: MaybeArray<SimpleJoinItem['args']>;
      ON?: WhereOnItem | WhereJsonPathEqualsItem;
    })
  | ((q: unknown) => QueryBase)
  | Query
  | Expression;

export type WhereInItem = {
  columns: string[];
  values: unknown[][] | Query | Expression;
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

export type SortDir = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST';

export type OrderItem = string | Record<string, SortDir> | Expression;

export type AggregateItemArg =
  | SelectableOrExpression
  | Record<string, SelectableOrExpression>
  | [SelectableOrExpression, string];

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
  | Expression;

export type WindowItem = Record<string, WindowDeclaration | Expression>;

export type WindowDeclaration = {
  partitionBy?: SelectableOrExpression | SelectableOrExpression[];
  order?: OrderItem;
};

export type UnionItem = Query | Expression;

export type UnionKind =
  | 'UNION'
  | 'UNION ALL'
  | 'INTERSECT'
  | 'INTERSECT ALL'
  | 'EXCEPT'
  | 'EXCEPT ALL';

export type OnConflictItem = string | string[] | Expression;

export type OnConflictMergeUpdate =
  | string
  | string[]
  | Record<string, unknown>
  | Expression;
