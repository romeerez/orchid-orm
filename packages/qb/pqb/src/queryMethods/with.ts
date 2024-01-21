import { WithOptions } from '../sql';
import { AddQueryWith, Query } from '../query/query';
import { Db } from '../query/db';
import { pushQueryValue, setQueryObjectValue } from '../query/queryUtils';
import {
  isExpression,
  Expression,
  emptyObject,
  ColumnsShapeBase,
  QueryColumns,
  ColumnSchemaConfig,
} from 'orchid-core';
import { DefaultColumnTypes } from '../columns';

// `with` method options
// - `columns`: true to get all columns from the query, or array of column names
// - `recursive`, `materialized`, `notMaterialized`: adds corresponding SQL keyword
type WithArgsOptions = {
  [K in keyof WithOptions]: K extends 'columns'
    ? boolean | string[]
    : WithOptions[K];
};

// `with` method arguments.
// First argument is an alias for the CTE query,
// other arguments may be a column shape, query object, or a raw SQL.
type WithArgs =
  | [string, ColumnsShapeBase, Expression]
  | [string, WithArgsOptions, ColumnsShapeBase, Expression]
  | [string, Query | ((qb: Db) => Query)]
  | [string, WithArgsOptions, Query | ((qb: Db) => Query)];

// Get the columns shape based on `with` arguments.
// It can get the shape from explicitly provided column schema or from a query object.
type WithShape<Args extends WithArgs> = Args[1] extends Query
  ? Args[1]['result']
  : Args[1] extends (qb: Db) => Query
  ? ReturnType<Args[1]>['result']
  : Args[2] extends Query
  ? Args[2]['result']
  : Args[2] extends (qb: Db) => Query
  ? ReturnType<Args[2]>['result']
  : Args[1] extends ColumnsShapeBase
  ? Args[1]
  : Args[2] extends ColumnsShapeBase
  ? Args[2]
  : Args[2] extends (
      t: DefaultColumnTypes<ColumnSchemaConfig>,
    ) => ColumnsShapeBase
  ? ReturnType<Args[2]> extends ColumnsShapeBase
    ? ReturnType<Args[2]>
    : never
  : never;

// Adds a `withData` entry to a query
type WithResult<
  T extends Query,
  Args extends WithArgs,
  Shape extends QueryColumns,
> = AddQueryWith<
  T,
  {
    table: Args[0];
    shape: Shape;
  }
>;

export class With {
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
   *   db.table.sql`SELECT id, name FROM "someTable"`,
   * );
   *
   * // accepts query:
   * db.table.with('alias', db.table.all());
   *
   * // accepts a callback for a query builder:
   * db.table.with('alias', (qb) =>
   *   qb.select({ one: db.table.sql((t) => t.integer())`1` }),
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
   *
   * @param args - first argument is an alias for this CTE, other arguments can be column shape, query object, or raw SQL.
   */
  with<
    T extends Query,
    Args extends WithArgs,
    Shape extends QueryColumns = WithShape<Args>,
  >(this: T, ...args: Args): WithResult<T, Args, Shape> {
    return this.clone()._with<T, Args, Shape>(...args);
  }
  _with<
    T extends Query,
    Args extends WithArgs,
    Shape extends QueryColumns = WithShape<Args>,
  >(this: T, ...args: Args): WithResult<T, Args, Shape> {
    let options =
      (args.length === 3 && !isExpression(args[2])) || args.length === 4
        ? (args[1] as WithArgsOptions | WithOptions)
        : undefined;

    const last = args[args.length - 1] as
      | Query
      | ((qb: Db) => Query)
      | Expression;

    const query = typeof last === 'function' ? last(this.queryBuilder) : last;

    const shape =
      args.length === 4
        ? (args[2] as ColumnsShapeBase)
        : isExpression(query)
        ? args[1]
        : query.q.shape;

    if (options?.columns === true) {
      options = {
        ...options,
        columns: Object.keys(shape),
      };
    }

    pushQueryValue(this, 'with', [args[0], options || emptyObject, query]);

    return setQueryObjectValue(
      this,
      'withShapes',
      args[0],
      shape,
    ) as unknown as WithResult<T, Args, Shape>;
  }
}
