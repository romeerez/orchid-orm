import { WithOptions } from '../sql';
import {
  PickQueryMetaWithDataColumnTypes,
  PickQueryWithDataColumnTypes,
  Query,
} from '../query/query';
import { pushQueryValue, setQueryObjectValue } from '../query/queryUtils';
import {
  Expression,
  ColumnsShapeBase,
  EmptyObject,
  PickQueryResult,
  QueryColumns,
} from 'orchid-core';
import { SqlMethod } from './sql';
import { getShapeFromSelect } from './select';
import { _queryUnion } from './union';

// `with` method options
// - `columns`: true to get all columns from the query, or array of column names
// - `materialized`, `notMaterialized`: adds corresponding SQL keyword
export interface WithArgsOptions {
  columns?: string[] | boolean;
  materialized?: true;
  notMaterialized?: true;
}

export interface WithRecursiveOptions extends WithArgsOptions {
  union?:
    | 'UNION'
    | 'UNION ALL'
    | 'INTERSECT'
    | 'INTERSECT ALL'
    | 'EXCEPT'
    | 'EXCEPT ALL';
}

export interface WithQueryBuilder<T extends PickQueryWithDataColumnTypes>
  extends Query {
  sql: SqlMethod<T['columnTypes']>['sql'];
  relations: EmptyObject;
  withData: T['withData'];
}

// Adds a `withData` entry to a query
export type WithResult<
  T extends PickQueryMetaWithDataColumnTypes,
  Name extends string,
  Q extends PickQueryResult,
> = {
  [K in keyof T]: K extends 'meta'
    ? { [K in keyof T['meta']]: K extends 'kind' ? 'select' : T['meta'][K] }
    : K extends 'withData'
    ? {
        [K in keyof T['withData'] | Name]: K extends Name
          ? {
              table: Name;
              shape: Q['result'];
            }
          : K extends keyof T['withData']
          ? T['withData'][K]
          : never;
      }
    : T[K];
};

export type WithSqlResult<
  T extends PickQueryWithDataColumnTypes,
  Name extends string,
  Shape extends QueryColumns,
> = {
  [K in keyof T]: K extends 'withData'
    ? {
        [K in Name | keyof T['withData']]: K extends Name
          ? {
              table: Name;
              shape: Shape;
            }
          : K extends keyof T['withData']
          ? T['withData'][K]
          : never;
      }
    : T[K];
};

export class WithMethods {
  /**
   * Add Common Table Expression (CTE) to the query.
   *
   * ```ts
   * import { columnTypes } from 'orchid-orm';
   * import { NumberColumn } from './number';
   *
   * // .with optionally accepts such options:
   * type WithOptions = {
   *   // list of columns returned by this WITH statement
   *   // by default all columns from provided column shape will be included
   *   // true is for default behavior
   *   columns?: string[] | boolean;
   *
   *   // Adds RECURSIVE keyword:
   *   recursive?: true;
   *
   *   // Adds MATERIALIZED keyword:
   *   materialized?: true;
   *
   *   // Adds NOT MATERIALIZED keyword:
   *   notMaterialized?: true;
   * };
   *
   * // accepts columns shape and a raw expression:
   * db.table.with(
   *   'alias',
   *   {
   *     id: columnTypes.integer(),
   *     name: columnTypes.text(3, 100),
   *   },
   *   sql`SELECT id, name FROM "someTable"`,
   * );
   *
   * // accepts query:
   * db.table.with('alias', db.table.all());
   *
   * // accepts a callback for a query builder:
   * db.table.with('alias', (qb) =>
   *   qb.select({ one: sql`1`.type((t) => t.integer()) }),
   * );
   *
   * // All mentioned forms can accept options as a second argument:
   * db.table.with(
   *   'alias',
   *   {
   *     recursive: true,
   *     materialized: true,
   *   },
   *   rawOrQueryOrCallback,
   * );
   * ```
   *
   * Defined `WITH` table can be used in `.from` or `.join` with all the type safeness:
   *
   * ```ts
   * db.table.with('alias', db.table.all()).from('alias').select('alias.id');
   *
   * db.table
   *   .with('alias', db.table.all())
   *   .join('alias', 'alias.id', 'user.id')
   *   .select('alias.id');
   * ```
   */
  with<T extends PickQueryMetaWithDataColumnTypes, Name extends string, Q>(
    this: T,
    name: Name,
    query: Q | ((q: WithQueryBuilder<T>) => Q),
  ): WithResult<T, Name, Q extends Query ? Q : never>;
  with<
    T extends PickQueryMetaWithDataColumnTypes,
    Name extends string,
    Q extends Query,
  >(
    this: T,
    name: Name,
    options: WithArgsOptions,
    query: Q | ((q: WithQueryBuilder<T>) => Q),
  ): WithResult<T, Name, Q>;
  with(
    name: string,
    second:
      | WithArgsOptions
      | Query
      | ((q: WithQueryBuilder<PickQueryWithDataColumnTypes>) => Query),
    third?:
      | Query
      | ((q: WithQueryBuilder<PickQueryWithDataColumnTypes>) => Query),
  ) {
    const q = (this as unknown as Query).clone();

    // eslint-disable-next-line prefer-const
    let [options, queryArg] = third
      ? [second as WithArgsOptions, third]
      : [undefined, second];

    let query: Query;
    if (typeof queryArg === 'function') {
      const arg = q.queryBuilder.clone();
      arg.q.withShapes = q.q.withShapes;
      query = queryArg(arg);
    } else {
      query = queryArg as Query;
    }

    if (options?.columns === true) {
      options = {
        ...options,
        columns: Object.keys(query.shape),
      };
    }

    pushQueryValue(q, 'with', { n: name, o: options, q: query });

    const shape = getShapeFromSelect(query, true);

    return setQueryObjectValue(q, 'withShapes', name, shape);
  }

  withRecursive<
    T extends PickQueryMetaWithDataColumnTypes,
    Name extends string,
    Q extends Query,
    Result = WithResult<T, Name, Q>,
  >(
    this: T,
    name: Name,
    base: Q | ((qb: WithQueryBuilder<T>) => Q),
    recursive: (qb: {
      [K in keyof Result]: K extends 'result' ? Q['result'] : Result[K];
    }) => Query,
  ): Result;
  withRecursive<
    T extends PickQueryMetaWithDataColumnTypes,
    Name extends string,
    Q extends Query,
    Result = WithResult<T, Name, Q>,
  >(
    this: T,
    name: Name,
    options: WithRecursiveOptions,
    base: Q | ((qb: WithQueryBuilder<T>) => Q),
    recursive: (qb: {
      [K in keyof Result]: K extends 'result' ? Q['result'] : Result[K];
    }) => Query,
  ): Result;
  withRecursive(name: string, ...args: unknown[]) {
    const q = (this as unknown as Query).clone();

    // eslint-disable-next-line prefer-const
    let [options, baseFn, recursiveFn] = (
      args.length === 2 ? [{}, args[0], args[1]] : args
    ) as [
      options: WithRecursiveOptions,
      base: Query | ((q: unknown) => Query),
      recursive: (q: unknown) => Query,
    ];

    const arg = q.queryBuilder.clone();
    arg.q.withShapes = q.q.withShapes;
    let query = typeof baseFn === 'function' ? baseFn(arg) : baseFn;
    const shape = ((arg.q.withShapes ??= {})[name] = getShapeFromSelect(
      query,
      true,
    ) as ColumnsShapeBase);
    const recursive = recursiveFn(arg);

    query = _queryUnion(query, [recursive], options.union ?? 'UNION ALL');

    (options as WithOptions).recursive = true;

    if (options.columns === true) {
      options = {
        ...options,
        columns: Object.keys(shape),
      };
    }

    pushQueryValue(q, 'with', { n: name, o: options, q: query });

    return setQueryObjectValue(q, 'withShapes', name, shape);
  }

  withSql<
    T extends PickQueryWithDataColumnTypes,
    Name extends string,
    Shape extends ColumnsShapeBase,
  >(
    this: T,
    name: Name,
    options: WithOptions,
    shape: (t: T['columnTypes']) => Shape,
    expr: (q: T) => Expression,
  ): WithSqlResult<T, Name, Shape>;
  withSql<
    T extends PickQueryWithDataColumnTypes,
    Name extends string,
    Shape extends ColumnsShapeBase,
  >(
    this: T,
    name: Name,
    shape: (t: T['columnTypes']) => Shape,
    expr: (q: T) => Expression,
  ): WithSqlResult<T, Name, Shape>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withSql(this: PickQueryWithDataColumnTypes, name: string, ...args: any[]) {
    const q = (this as unknown as Query).clone();

    const [options, shape, sql] =
      args.length === 2 ? [undefined, args[0], args[1]] : args;

    pushQueryValue(q, 'with', {
      n: name,
      o: options,
      s: sql(q),
    });

    return setQueryObjectValue(
      q,
      'withShapes',
      name,
      shape(this.columnTypes),
    ) as never;
  }
}
