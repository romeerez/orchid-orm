import { WithItem, WithOptions } from '../sql';
import {
  PickQueryMetaWithDataColumnTypes,
  PickQueryWithDataColumnTypes,
  Query,
} from '../query/query';
import {
  _clone,
  saveAliasedShape,
  setQueryObjectValueImmutable,
} from '../query/queryUtils';
import {
  Expression,
  ColumnsShapeBase,
  EmptyObject,
  PickQueryResult,
  QueryColumns,
  RecordUnknown,
  pushOrNewArrayToObjectImmutable,
  pushQueryValueImmutable,
} from 'orchid-core';
import { SqlMethod } from './sql';
import { getShapeFromSelect } from './select';
import { _queryUnion } from './union';
import { RawSQL } from '../sql/rawSql';

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

const addWith = (
  q: Query,
  withStore: object,
  item: WithItem,
  key: string | number = 'with',
) => {
  // WITH clause containing a data-modifying statement must be at the top level
  if (item.q) {
    item.q.q.with?.forEach((item, i, arr) => {
      if (item?.q?.q.type) {
        pushOrNewArrayToObjectImmutable(withStore, key, item);
        arr[i] = undefined;
      }
    });

    if (item.q.q.insertWith) {
      const values = Object.values(item.q.q.insertWith).flat();
      item.q.q.insertWith = undefined;
      q.q.with = q.q.with ? [...q.q.with, ...values] : values;
    }
  }

  pushOrNewArrayToObjectImmutable(withStore, key, item);
};

export const moveQueryValueToWith = (
  q: Query,
  withStore: object,
  value: Query,
  set: RecordUnknown,
  key: string,
  withKey: string | number,
) => {
  // if it is not a select query,
  // move it into `WITH` statement and select from it with a raw SQL
  if (value.q.type) {
    const as = saveAliasedShape(q as Query, 'q', 'withShapes');

    addWith(
      q,
      withStore,
      {
        n: as,
        q: value,
      },
      withKey,
    );

    set[key] = new RawSQL(`(SELECT * FROM "${as}")`);
  }
};

export class WithMethods {
  /**
   * Use `with` to add a Common Table Expression (CTE) to the query.
   *
   * `with` can be chained to any table on `db` instance, or to `db.$qb`,
   * note that in the latter case it won't have customized column types to use for typing SQL.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // can access custom columns when using off a table
   * db.anyTable.with('x', (q) =>
   *   q.select({ column: (q) => sql`123`.type((t) => t.customColumn()) }),
   * );
   *
   * // only default columns are available when using off `$qb`
   * db.$qb.with('x', (q) =>
   *   q.select({ column: (q) => sql`123`.type((t) => t.integer()) }),
   * );
   * ```
   *
   * `with` accepts query objects, callbacks returning query objects, and custom SQL expressions returned from callbacks.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * db.table
   *   .with(
   *     'alias',
   *     // define CTE by building a query
   *     db.table.select('one', 'two', 'three').where({ x: 123 }),
   *   )
   *   .from('alias')
   *   .select('one')
   *   .where({ two: 123 });
   *
   * // 2nd argument can be a callback accepting a query builder
   * db.table
   *   .with('alias', (q) =>
   *     // select a custom sql
   *     q.select({ column: (q) => sql`123`.type((t) => t.integer()) }),
   *   )
   *   .from('alias')
   *   .select('column')
   *   .where({ column: 123 });
   *
   * // 2nd argument can be used for options
   * db.table
   *   .with(
   *     'alias',
   *     {
   *       // all parameters are optional
   *       materialized: true,
   *       notMaterialized: true,
   *     },
   *     db.table,
   *   )
   *   .from('alias');
   * ```
   *
   * One `WITH` expression can reference the other:
   *
   * ```ts
   * db.$qb
   *   .with('a', db.table.select('id', 'name'))
   *   .with('b', (q) => q.from('a').where({ key: 'value' }))
   *   .from('b');
   * ```
   *
   * Defined `WITH` expression can be used in `.from` or `.join` with all the type safeness:
   *
   * ```ts
   * db.table.with('alias', db.table).from('alias').select('alias.id');
   *
   * db.firstTable
   *   .with('secondTable', db.secondTable)
   *   .join('secondTable', 'secondTable.someId', 'firstTable.id')
   *   .select('firstTable.column', 'secondTable.column');
   * ```
   */
  with<T extends PickQueryMetaWithDataColumnTypes, Name extends string, Q>(
    this: T,
    name: Name,
    query: Q | ((q: WithQueryBuilder<T>) => Q),
  ): WithResult<T, Name, Q extends PickQueryResult ? Q : never>;
  with<
    T extends PickQueryMetaWithDataColumnTypes,
    Name extends string,
    Q extends PickQueryResult,
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
      | PickQueryResult
      | ((
          q: WithQueryBuilder<PickQueryWithDataColumnTypes>,
        ) => PickQueryResult),
    third?:
      | PickQueryResult
      | ((
          q: WithQueryBuilder<PickQueryWithDataColumnTypes>,
        ) => PickQueryResult),
  ) {
    const q = _clone(this);

    // eslint-disable-next-line prefer-const
    let [options, queryArg] = third
      ? [second as WithArgsOptions, third]
      : [undefined, second];

    let query: Query;
    if (typeof queryArg === 'function') {
      const arg = q.qb.clone();
      arg.q.withShapes = q.q.withShapes;
      query = queryArg(arg) as Query;
    } else {
      query = queryArg as Query;
    }

    if (options?.columns === true) {
      options = {
        ...options,
        columns: Object.keys(query.shape),
      };
    }

    addWith(q, q.q, { n: name, o: options as WithOptions, q: query });

    const shape = getShapeFromSelect(query, true);
    return setQueryObjectValueImmutable(q, 'withShapes', name, {
      shape: shape as ColumnsShapeBase,
      computeds: query.q.computeds,
    });
  }

  /**
   * It is priceless for fetching tree-like structures, or any other recursive cases.
   *
   * For example, it is useful for loading a tree of categories, where one category can include many other categories.
   *
   * Similarly to [with](#with), `withRecursive` can be chained to any table or `db.$qb`.
   *
   * For the first example, consider the employee table, an employee may or may not have a manager.
   *
   * ```ts
   * class Employee extends BaseTable {
   *   readonly table = 'employee';
   *   columns = this.setColumns((t) => ({
   *     id: t.identity().primaryKey(),
   *     name: t.string(),
   *     managerId: t.integer().nullable(),
   *   }));
   * }
   * ```
   *
   * The task is to load all subordinates of the manager with the id 1.
   *
   * ```ts
   * db.$qb
   *   .withRecursive(
   *     'subordinates',
   *     // the base, anchor query: find the manager to begin recursion with
   *     Employee.select('id', 'name', 'managerId').find(1),
   *     // recursive query:
   *     // find employees whos managerId is id from the surrounding subordinates CTE
   *     (q) =>
   *       q
   *         .from(Employee)
   *         .select('id', 'name', 'managerId')
   *         .join('subordinates', 'subordinates.id', 'profile.managerId'),
   *   )
   *   .from('subordinates');
   * ```
   *
   * As being shown, `withRecursive` accepts one query to begin with, and a second query in a callback that can reference the surrounding table expression "subordinates".
   *
   * These two queries are joined with `UNION ALL` by default.
   *
   * You can customize it by passing options after the name.
   *
   * ```ts
   * db.$qb
   *   .withRecursive(
   *     'subordinates',
   *     {
   *       // all parameters are optional
   *       union: 'UNION',
   *       materialized: true,
   *       notMaterialized: true,
   *     },
   *     // ...snip
   *   )
   *   .from('subordinates');
   * ```
   *
   * Recursive query can be constructed with basic SQL instructions only, without referencing other tables.
   * In the following example, we recursively select numbers from 1 to 100, and additionally apply n > 10 filter in the end.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * db.$qb
   *   .withRecursive(
   *     't',
   *     // select `1 AS n` for the base query
   *     (q) => q.select({ n: (q) => sql`1`.type((t) => t.integer()) }),
   *     // select `n + 1 AS n` for the recursive part
   *     (q) =>
   *       q
   *         .from('t')
   *         // type can be omitted here because it was defined in the base query
   *         .select({ n: (q) => sql`n + 1` })
   *         .where({ n: { lt: 100 } }),
   *   )
   *   .from('t')
   *   .where({ n: { gt: 10 } });
   * ```
   */
  withRecursive<
    T extends PickQueryMetaWithDataColumnTypes,
    Name extends string,
    Q extends PickQueryResult,
    Result = WithResult<T, Name, Q>,
  >(
    this: T,
    name: Name,
    base: Q | ((qb: WithQueryBuilder<T>) => Q),
    recursive: (qb: {
      [K in keyof Result]: K extends 'result' ? Q['result'] : Result[K];
    }) => PickQueryResult,
  ): Result;
  withRecursive<
    T extends PickQueryMetaWithDataColumnTypes,
    Name extends string,
    Q extends PickQueryResult,
    Result = WithResult<T, Name, Q>,
  >(
    this: T,
    name: Name,
    options: WithRecursiveOptions,
    base: Q | ((qb: WithQueryBuilder<T>) => Q),
    recursive: (qb: {
      [K in keyof Result]: K extends 'result' ? Q['result'] : Result[K];
    }) => PickQueryResult,
  ): Result;
  withRecursive(name: string, ...args: unknown[]) {
    const q = _clone(this);

    // eslint-disable-next-line prefer-const
    let [options, baseFn, recursiveFn] = (
      args.length === 2 ? [{}, args[0], args[1]] : args
    ) as [
      options: WithRecursiveOptions,
      base: Query | ((q: unknown) => Query),
      recursive: (q: unknown) => Query,
    ];

    const arg = q.qb.clone();
    arg.q.withShapes = q.q.withShapes;
    let query = typeof baseFn === 'function' ? baseFn(arg) : baseFn;
    const shape = getShapeFromSelect(query, true) as ColumnsShapeBase;
    const withConfig = { shape, computeds: query.q.computeds };
    (arg.q.withShapes ??= {})[name] = withConfig;
    const recursive = recursiveFn(arg);

    query = _queryUnion(query, [recursive], options.union ?? 'UNION ALL');

    (options as WithOptions).recursive = true;

    if (options.columns === true) {
      options = {
        ...options,
        columns: Object.keys(shape),
      };
    }

    addWith(q, q.q, { n: name, o: options as WithOptions, q: query });

    return setQueryObjectValueImmutable(q, 'withShapes', name, withConfig);
  }

  /**
   * Use `withSql` to add a Common Table Expression (CTE) based on a custom SQL.
   *
   * Similarly to [with](#with), `withRecursive` can be chained to any table or `db.$qb`.
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * db.table
   *   .withSql(
   *     'alias',
   *     // define column types of the expression:
   *     (t) => ({
   *       one: t.integer(),
   *       two: t.string(),
   *     }),
   *     // define SQL expression:
   *     (q) => sql`(VALUES (1, 'two')) t(one, two)`,
   *   )
   *   // is not prefixed in the middle of a query chain
   *   .withSql(
   *     'second',
   *     (t) => ({
   *       x: t.integer(),
   *     }),
   *     (q) => sql`(VALUES (1)) t(x)`,
   *   )
   *   .from('alias');
   * ```
   *
   * Options can be passed via a second argument:
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * db.table
   *   .withSql(
   *     'alias',
   *     {
   *       // all parameters are optional
   *       recursive: true,
   *       materialized: true,
   *       notMaterialized: true,
   *     },
   *     (t) => ({
   *       one: t.integer(),
   *       two: t.string(),
   *     }),
   *     (q) => sql`(VALUES (1, 'two')) t(one, two)`,
   *   )
   *   .from('alias');
   * ```
   */
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
    const q = _clone(this);

    const [options, shape, sql] =
      args.length === 2 ? [undefined, args[0], args[1]] : args;

    pushQueryValueImmutable(q, 'with', {
      n: name,
      o: options,
      s: sql(q),
    });

    return setQueryObjectValueImmutable(q, 'withShapes', name, {
      shape: shape(this.columnTypes),
    });
  }
}
