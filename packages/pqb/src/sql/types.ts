import {
  ColumnsParsers,
  Query,
  QueryWithTable,
  Selectable,
  SelectableBase,
} from '../query';
import { Expression, RawExpression } from '../common';
import { Aggregate1ArgumentTypes } from '../aggregateMethods';
import { ColumnsShape, ColumnShapeOutput } from '../columnSchema';
import { JoinQuery } from '../queryMethods';

export type QueryData<T extends Query = Query> = {
  take?: true;
  with?: WithItem[];
  withShapes?: Record<string, ColumnsShape>;
  schema?: string;
  select?: SelectItem<T>[];
  distinct?: Expression<T>[];
  from?: string | Query | RawExpression;
  fromOnly?: boolean;
  join?: JoinItem[];
  joinedParsers?: Record<string, ColumnsParsers>;
  and?: WhereItem<T>[];
  or?: WhereItem<T>[][];
  as?: string;
  group?: (Selectable<T> | RawExpression)[];
  having?: HavingArg<T>[];
  window?: WindowArg<T>[];
  union?: { arg: UnionArg<T>; kind: UnionKind }[];
  order?: OrderBy<T>[];
  limit?: number;
  offset?: number;
  for?: RawExpression[];
  parsers?: ColumnsParsers;
};

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

export type SelectItem<T extends Query> =
  | keyof T['selectable']
  | Aggregate<T>
  | { selectAs: Record<string, keyof T['selectable'] | Query | RawExpression> };

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

export type WhereItem<T extends Query> =
  | Partial<ColumnShapeOutput<T['shape']>>
  | {
      [K in keyof T['selectable']]?:
        | ColumnOperators<T['selectable'], K>
        | RawExpression;
    }
  | Query
  | RawExpression
  | [leftFullColumn: string, op: string, rightFullColumn: string];

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
  arg: AggregateArg<T>;
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
  partitionBy?: Expression<T>;
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
