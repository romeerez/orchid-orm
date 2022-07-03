import { Query } from '../query';
import { Expression, RawExpression } from '../common';
import { Aggregate1ArgumentTypes } from '../aggregateMethods';
import { ColumnsShape, Output } from '../schema';

export type QueryData<T extends Query = Query> = {
  take?: true;
  select?: SelectItem<T>[];
  distinct?: Expression<T>[];
  from?: string | RawExpression;
  join?: JoinItem[];
  and?: WhereItem<T>[];
  or?: WhereItem<T>[][];
  as?: string;
  group?: (keyof T['type'] | RawExpression)[];
  having?: HavingArg<T>[];
  window?: WindowArg<T>[];
  union?: { arg: UnionArg<T>; kind: UnionKind }[];
  order?: OrderBy<T>[];
  limit?: number;
  offset?: number;
  for?: RawExpression[];
};

export type SelectItem<T extends Query> =
  | keyof T['type']
  | Aggregate<T>
  | { selectAs: Record<string, Expression<T> | Query> };

export type JoinItem =
  | [relation: string]
  | [query: Query, leftColumn: string, op: string, rightColumn: string]
  | [query: Query, raw: RawExpression]
  | [query: Query, on: Query];

export type WhereItem<T extends Query> =
  | Partial<Output<T['shape']>>
  | { [K in keyof T['shape']]?: ColumnOperators<T['shape'], K> | RawExpression }
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
      [K in keyof T['type']]?:
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

export type ColumnOperators<S extends ColumnsShape, Column extends keyof S> = {
  [O in keyof S[Column]['operators']]?: S[Column]['operators'][O]['type'];
};

export type HavingArg<T extends Query = Query> =
  | {
      [Agg in keyof Aggregate1ArgumentTypes<T>]?: {
        [Column in Exclude<Aggregate1ArgumentTypes<T>[Agg], RawExpression>]?:
          | T['type'][Column]
          | (ColumnOperators<T['shape'], Column> & AggregateOptions<T>);
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
