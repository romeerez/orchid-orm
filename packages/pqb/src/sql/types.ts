import {
  ColumnsParsers,
  Query,
  QueryWithTable,
  Selectable,
  SelectableBase,
} from '../query';
import { Expression, RawExpression } from '../common';
import { Aggregate1ArgumentTypes } from '../queryMethods/aggregate';
import { ColumnsShape, ColumnType } from '../columnSchema';
import { JoinQuery } from '../queryMethods/join';

export type CommonQueryData = {
  take?: true;
  with?: WithItem[];
  withShapes?: Record<string, ColumnsShape>;
  schema?: string;
  as?: string;
  and?: { item: WhereItem; not?: boolean }[];
  or?: { item: WhereItem; not?: boolean }[][];
  parsers?: ColumnsParsers;
};

export type SelectQueryData<T extends Query = Query> = CommonQueryData & {
  select?: SelectItem<T>[];
  distinct?: Expression<T>[];
  from?: string | Query | RawExpression;
  fromOnly?: boolean;
  join?: JoinItem[];
  joinedParsers?: Record<string, ColumnsParsers>;
  group?: (Selectable<T> | RawExpression)[];
  having?: HavingArg<T>[];
  window?: WindowArg<T>[];
  union?: { arg: UnionArg<T>; kind: UnionKind; wrap?: boolean }[];
  order?: OrderBy<T>[];
  limit?: number;
  offset?: number;
  for?: {
    type: 'UPDATE' | 'NO KEY UPDATE' | 'SHARE' | 'KEY SHARE';
    tableNames: string[] | RawExpression;
    mode?: 'NO WAIT' | 'SKIP LOCKED';
  };
};

export type InsertQueryData = CommonQueryData & {
  type: 'insert';
  data:
    | Record<string, unknown>
    | Record<string, unknown>[]
    | {
        columns: string[];
        values: RawExpression;
      };
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
        update?: string | string[] | Record<string, unknown> | RawExpression;
      };
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

export type QueryData<T extends Query = Query> =
  | SelectQueryData<T>
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

export type SelectItem<T extends Query> =
  | keyof T['selectable']
  | Aggregate<T>
  | { selectAs: Record<string, keyof T['selectable'] | Query | RawExpression> }
  | JsonItem
  | RawExpression;

export type JoinItem =
  | [relation: string]
  | [
      withOrQuery: string | QueryWithTable,
      leftColumn: string,
      op: string,
      rightColumn: string,
    ]
  | [
      withOrQuery: string | QueryWithTable,
      rawOrJoinQuery: RawExpression | JoinQuery,
    ];

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
      type: 'on';
      on: [leftFullColumn: string, op: string, rightFullColumn: string];
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
      query: Query | RawExpression;
    };

export type AggregateOptions<
  T extends Query = Query,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  As extends string | undefined = any,
> = {
  as?: As;
  distinct?: boolean;
  order?: string;
  filter?: string;
  withinGroup?: boolean;
  over?: T['windows'][number] | WindowDeclaration<T>;
};

export type SortDir = 'ASC' | 'DESC';

export type OrderBy<T extends Query> =
  | {
      [K in Selectable<T>]?:
        | SortDir
        | { dir: SortDir; nulls: 'FIRST' | 'LAST' };
    }
  | RawExpression;

export type AggregateArg<T extends Query> =
  | Expression<T>
  | Record<string, Expression<T>>
  | [Expression<T>, string];

export type Aggregate<T extends Query = Query> = {
  function: string;
  arg?: AggregateArg<T>;
  options: AggregateOptions<T>;
};

export type ColumnOperators<
  S extends SelectableBase,
  Column extends keyof S,
> = {
  [O in keyof S[Column]['column']['operators']]?: S[Column]['column']['operators'][O]['type'];
};

export type HavingArg<T extends Query = Query> =
  | {
      [Agg in keyof Aggregate1ArgumentTypes<T>]?: {
        [Column in Exclude<Aggregate1ArgumentTypes<T>[Agg], RawExpression>]?:
          | T['selectable'][Column]['column']['type']
          | (ColumnOperators<T['selectable'], Column> & AggregateOptions<T>);
      };
    }
  | RawExpression;

export type WindowArg<T extends Query> = Record<
  string,
  WindowDeclaration<T> | RawExpression
>;

export type WindowDeclaration<T extends Query = Query> = {
  partitionBy?: Expression<T> | Expression<T>[];
  order?: OrderBy<T>;
};

export type UnionArg<T extends Query> =
  | (Omit<Query, 'result'> & { result: T['result'] })
  | RawExpression;

type UnionKind =
  | 'UNION'
  | 'UNION ALL'
  | 'INTERSECT'
  | 'INTERSECT ALL'
  | 'EXCEPT'
  | 'EXCEPT ALL';

type OnConflictItem = string | string[] | RawExpression;
