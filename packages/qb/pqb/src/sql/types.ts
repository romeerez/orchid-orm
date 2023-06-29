import { Query, QueryWithTable, SelectableBase } from '../query';
import { RelationQuery } from '../relations';
import { SelectableOrExpression } from '../utils';
import { SelectQueryData } from './data';
import {
  ColumnTypeBase,
  Expression,
  MaybeArray,
  TemplateLiteralArgs,
} from 'orchid-core';
import { QueryBase } from '../queryBase';

// used in `from` logic to decide if convert query to sql or just write table name
export const checkIfASimpleQuery = (q: Query) => {
  if (
    (q.q.returnType && q.q.returnType !== 'all') ||
    q.internal.columnsForSelectAll ||
    q.q.and?.length ||
    q.q.or?.length
  )
    return false;

  const keys = Object.keys(q.q) as (keyof SelectQueryData)[];
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
  | { selectAs: Record<string, string | Query | Expression> }
  | JsonItem
  | Expression;

export type OrderTsQueryConfig =
  | true
  | {
      coverDensity?: boolean;
      weights?: number[];
      normalization?: number;
      dir?: SortDir;
    };

export type QuerySourceItem = {
  queryAs: string;
  as?: string;
  textSQL?: MaybeArray<string>;
  langSQL?: string;
  vectorSQL?: string;
  order?: OrderTsQueryConfig;
} & (
  | {
      language?: string;
    }
  | {
      languageColumn: string;
    }
) &
  (
    | {
        text: string | Expression;
      }
    | {
        in: MaybeArray<string> | Record<string, SearchWeight>;
      }
    | {
        vector: string;
      }
  ) &
  (
    | {
        query: string | Expression;
      }
    | {
        plainQuery: string | Expression;
      }
    | {
        phraseQuery: string | Expression;
      }
    | {
        tsQuery: string | Expression;
      }
  );

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
      SEARCH?: MaybeArray<WhereSearchItem>;
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

export type WhereOnJoinItem = { table?: string; q: { as?: string } } | string;

export type SearchWeight = 'A' | 'B' | 'C' | 'D';

export type WhereSearchItem = {
  as: string;
  vectorSQL: string;
};

export type SortDir = 'ASC' | 'DESC' | 'ASC NULLS FIRST' | 'DESC NULLS LAST';

export type OrderItem = string | Record<string, SortDir> | Expression;

export type ColumnOperators<
  S extends SelectableBase,
  Column extends keyof S,
> = {
  [O in keyof S[Column]['column']['operators']]?:
    | S[Column]['column']['operators'][O]['type'];
};

export type HavingItem = TemplateLiteralArgs | Expression[];

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
