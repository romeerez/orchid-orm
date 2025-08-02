import {
  PickQueryMetaResultReturnTypeWithDataWindowsThen,
  PickQueryQ,
  PickQueryRelations,
  Query,
  SetQueryReturnsAll,
  QueryTake,
  QueryTakeOptional,
  SetQueryReturnsPluck,
  SetQueryReturnsRows,
  SetQueryReturnsVoid,
  SetQueryReturnsVoidKind,
  SetQueryTableAlias,
  WithDataItems,
  PickQueryShapeResultReturnTypeSinglePrimaryKey,
  PickQueryMetaShapeRelationsReturnType,
  PickQueryTableMetaResultReturnTypeWithDataWindowsThen,
} from '../query/query';
import {
  AliasOrTable,
  getClonedQueryData,
  SelectableOrExpression,
  SelectableOrExpressions,
} from '../common/utils';
import {
  OrderTsQueryConfig,
  SelectQueryData,
  SortDir,
  toSQL,
  ToSQLOptions,
  ToSQLQuery,
  TruncateQueryData,
} from '../sql';
import {
  _clone,
  _queryAll,
  _queryExec,
  _queryRows,
  _queryTake,
  _queryTakeOptional,
  pushQueryArrayImmutable,
  setQueryObjectValueImmutable,
} from '../query/queryUtils';
import { Then } from './then';
import { AggregateMethods } from './aggregate';
import { addParserForSelectItem, Select } from './select';
import { FromMethods, FromQuerySelf } from './from';
import { Join, JoinResultRequireMain, OnMethods } from './join/join';
import { WithMethods } from './with';
import { Union } from './union';
import { JsonMethods } from './json';
import { QueryCreate } from './mutate/create';
import { Update } from './mutate/update';
import { Delete } from './mutate/delete';
import { Transaction } from './transaction';
import { For } from './for';
import {
  _queryFindBy,
  _queryFindByOptional,
  _queryWhere,
  _queryWhereSql,
  QueryMetaHasWhere,
  Where,
} from './where/where';
import { SearchMethods } from './search';
import { Clear } from './clear';
import { Having } from './having';
import { QueryLog } from './log';
import { QueryHooks } from './hooks';
import { QueryUpsert } from './mutate/upsert';
import { QueryGet } from './get';
import { MergeQuery, MergeQueryMethods } from './merge';
import { SqlMethod } from './sql';
import {
  applyMixins,
  EmptyObject,
  Expression,
  IsQuery,
  PickQueryMeta,
  PickQueryMetaResult,
  PickQueryMetaResultReturnType,
  PickQueryMetaShape,
  PickQueryResult,
  PickQueryResultReturnType,
  PickQueryResultReturnTypeUniqueColumns,
  PickQueryTableMetaResult,
  PickQueryTableMetaShape,
  pushQueryValueImmutable,
  QueryColumns,
  QueryMetaBase,
  QueryMetaIsSubQuery,
  QueryReturnType,
  QueryThen,
  QueryThenByQuery,
  QueryThenShallowSimplify,
  QueryThenShallowSimplifyArr,
  QueryThenShallowSimplifyOptional,
  RecordUnknown,
  Sql,
  SQLQueryArgs,
} from 'orchid-core';
import { AsMethods } from './as';
import { OrchidOrmInternalError } from '../errors';
import { TransformMethods } from './transform';
import { QueryMap } from './map';
import { sqlQueryArgsToExpression } from '../sql/rawSql';
import { ScopeMethods } from './scope';
import { SoftDeleteMethods } from './mutate/softDelete';
import { queryWrap } from './queryMethods.utils';
import { ExpressionMethods } from './expressions';
import { _queryNone } from './none';
import { _chain } from './chain';
import { QueryOrCreate } from './mutate/orCreate';

// argument of the window method
// it is an object where keys are name of windows
// and values can be a window options or a raw SQL
export interface WindowArg<T extends OrderArgSelf> {
  [K: string]: WindowArgDeclaration<T> | Expression;
}

// SQL window options to specify partitionBy and order of the window
export interface WindowArgDeclaration<T extends OrderArgSelf = OrderArgSelf> {
  partitionBy?: SelectableOrExpression<T> | SelectableOrExpressions<T>;
  order?: OrderArg<T>;
}

// add new windows to a query
type WindowResult<T, W extends RecordUnknown> = T & {
  windows: { [K in keyof W]: true };
};

export type OrderArgSelf = PickQueryMetaResult;

export type OrderArg<T extends OrderArgSelf> =
  | OrderArgKey<T>
  | OrderArgTsQuery<T>
  | {
      [K in OrderArgKey<T> | OrderArgTsQuery<T>]?: K extends OrderArgTsQuery<T>
        ? OrderTsQueryConfig
        : SortDir;
    }
  | Expression;

export type OrderArgs<T extends OrderArgSelf> = OrderArg<T>[];

type OrderArgTsQuery<T extends OrderArgSelf> =
  | string
  | undefined extends T['meta']['tsQuery']
  ? never
  : Exclude<T['meta']['tsQuery'], undefined>;

type OrderArgKey<T extends OrderArgSelf> =
  | {
      // filter out runtime computed selectables
      [K in keyof T['meta']['selectable']]: T['meta']['selectable'][K]['column']['queryType'] extends undefined
        ? never
        : K;
    }[keyof T['meta']['selectable']]
  // separate mappings are better than a single combined
  | {
      [K in keyof T['result']]: T['result'][K]['dataType'] extends
        | 'array'
        | 'object'
        | 'runtimeComputed'
        ? never
        : K;
    }[keyof T['result']];

export type GroupArgs<T extends PickQueryResult> = (
  | {
      [K in keyof T['result']]: T['result'][K]['dataType'] extends
        | 'array'
        | 'object'
        | 'runtimeComputed'
        ? never
        : K;
    }[keyof T['result']]
  | Expression
)[];

interface QueryHelperQuery<T extends PickQueryMetaShape> {
  returnType: QueryReturnType;
  meta: QueryMetaBase & {
    // Omit is optimal
    selectable: Omit<
      T['meta']['selectable'],
      `${AliasOrTable<T>}.${Extract<keyof T['shape'], string>}`
    >;
  };
  result: QueryColumns;
  windows: EmptyObject;
  withData: WithDataItems;
  then: unknown;
}

interface IsQueryHelper {
  isQueryHelper: true;
  table: string | undefined;
  args: unknown[];
  result: unknown;
}

interface IsQueryHelperForTable<Table extends string | undefined>
  extends IsQueryHelper {
  table: Table;
}

interface QueryHelper<
  T extends PickQueryTableMetaShape,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends any[],
  Result,
> extends IsQueryHelper {
  <Q extends QueryHelperQuery<T>>(
    q: Q,
    ...args: Args
  ): Result extends PickQueryMetaResultReturnTypeWithDataWindowsThen
    ? MergeQuery<Q, Result>
    : Result;

  table: T['table'];
  args: Args;
  result: Result;
}

// Get result of query helper, for https://github.com/romeerez/orchid-orm/issues/215
export type QueryHelperResult<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends QueryHelper<PickQueryMetaShape, any[], unknown>,
> = T['result'];

interface NarrowTypeSelf extends PickQueryMetaResultReturnType {
  returnType:
    | undefined
    | 'all'
    | 'one'
    | 'oneOrThrow'
    | 'value'
    | 'valueOrThrow'
    | 'pluck';
}

type NarrowInvalidKeys<T extends PickQueryResult, Narrow> = {
  [K in keyof Narrow]: K extends keyof T['result']
    ? Narrow[K] extends T['result'][K]['outputType']
      ? never
      : K
    : K;
}[keyof Narrow];

interface NarrowValueTypeResult<T extends PickQueryMetaResultReturnType, Narrow>
  extends QueryColumns {
  value: {
    [K in keyof T['result']['value']]: K extends 'outputType'
      ? Narrow
      : T['result']['value'][K];
  };
}

interface NarrowPluckTypeResult<T extends PickQueryMetaResultReturnType, Narrow>
  extends QueryColumns {
  pluck: {
    [K in keyof T['result']['pluck']]: K extends 'outputType'
      ? Narrow extends unknown[]
        ? Narrow[number]
        : Narrow
      : T['result']['pluck'][K];
  };
}

type QueryIfResult<
  T extends PickQueryMetaResultReturnType,
  R extends PickQueryResult,
> = {
  [K in keyof T]: K extends 'result'
    ? {
        [K in
          | keyof T['result']
          | keyof R['result']]: K extends keyof T['result']
          ? K extends keyof R['result']
            ? R['result'][K] | T['result'][K]
            : T['result'][K]
          : R['result'][K];
      }
    : K extends 'then'
    ? QueryIfResultThen<T, R>
    : T[K];
};

export type QueryIfResultThen<
  T extends PickQueryMetaResultReturnType,
  R extends PickQueryResult,
> = T['returnType'] extends undefined | 'all'
  ? QueryThenShallowSimplifyArr<
      {
        [K in keyof T['result']]: K extends keyof R['result']
          ? T['result'][K]['outputType'] | R['result'][K]['outputType']
          : T['result'][K]['outputType'];
      } & {
        [K in keyof R['result'] as K extends keyof T['result']
          ? never
          : K]?: R['result'][K]['outputType'];
      }
    >
  : T['returnType'] extends 'one'
  ? QueryThenShallowSimplifyOptional<
      {
        [K in keyof T['result']]: K extends keyof R['result']
          ? T['result'][K]['outputType'] | R['result'][K]['outputType']
          : T['result'][K]['outputType'];
      } & {
        [K in keyof R['result'] as K extends keyof T['result']
          ? never
          : K]?: R['result'][K]['outputType'];
      }
    >
  : T['returnType'] extends 'oneOrThrow'
  ? QueryThenShallowSimplify<
      {
        [K in keyof T['result']]: K extends keyof R['result']
          ? T['result'][K]['outputType'] | R['result'][K]['outputType']
          : T['result'][K]['outputType'];
      } & {
        [K in keyof R['result'] as K extends keyof T['result']
          ? never
          : K]?: R['result'][K]['outputType'];
      }
    >
  : T['returnType'] extends 'value'
  ? QueryThen<
      | T['result']['value']['outputType']
      | R['result']['value']['outputType']
      | undefined
    >
  : T['returnType'] extends 'valueOrThrow'
  ? QueryThen<
      T['result']['value']['outputType'] | R['result']['value']['outputType']
    >
  : T['returnType'] extends 'rows'
  ? QueryThen<
      (
        | T['result'][keyof T['result']]['outputType']
        | R['result'][keyof R['result']]['outputType']
      )[][]
    >
  : T['returnType'] extends 'pluck'
  ? QueryThen<
      (
        | T['result']['pluck']['outputType']
        | R['result']['pluck']['outputType']
      )[]
    >
  : QueryThen<void>;

interface SubQueryReturningSingle extends QueryMetaIsSubQuery {
  returnType: 'one' | 'oneOrThrow';
}

export interface QueryMethods<ColumnTypes>
  extends AsMethods,
    AggregateMethods,
    Select,
    FromMethods,
    Join,
    WithMethods,
    Union,
    JsonMethods,
    QueryCreate,
    Update,
    Delete,
    Transaction,
    For,
    Where,
    SearchMethods,
    Clear,
    Having,
    QueryLog,
    QueryHooks,
    QueryUpsert,
    QueryOrCreate,
    QueryGet,
    MergeQueryMethods,
    SqlMethod<ColumnTypes>,
    TransformMethods,
    QueryMap,
    ScopeMethods,
    SoftDeleteMethods,
    ExpressionMethods {}

export type WrapQueryArg = FromQuerySelf;

export class QueryMethods<ColumnTypes> {
  /**
   * Clones the current query chain, useful for re-using partial query snippets in other queries without mutating the original.
   *
   * Used under the hood, and not really needed on the app side.
   */
  clone<T>(this: T): T {
    const cloned = Object.create((this as unknown as Query).baseQuery);
    cloned.q = getClonedQueryData((this as unknown as PickQueryQ).q);
    return cloned;
  }

  /**
   * `.all` is a default behavior, that returns an array of objects:
   *
   * ```ts
   * const records = db.table
   *   .take() // .take() will be overridden by .all()
   *   .all();
   * ```
   */
  all<T extends PickQueryResult>(this: T): SetQueryReturnsAll<T> {
    return _queryAll(_clone(this)) as never;
  }

  /**
   * Use `take` to "take" a single record. It adds `LIMIT 1`, throws a `NotFoundError` when not found.
   *
   * ```ts
   * const taken: TableType = await db.table.where({ key: 'value' }).take();
   * ```
   *
   * Makes no effect if the query previously has `get`, `pluck`, `exec`.
   *
   * Changes `getOptional` to `get`.
   */
  take<T extends PickQueryResultReturnType>(this: T): QueryTake<T> {
    return _queryTake(_clone(this)) as never;
  }

  /**
   * Use `takeOptional` to "take" a single record. It adds `LIMIT 1`, returns `undefined` when not found.
   *
   * ```ts
   * const takenOptional: TableType | undefined = await db.table
   *   .where({ key: 'value' })
   *   .takeOptional();
   * ```
   *
   * Makes no effect if the query previously has `getOptional`, `pluck`, `exec`.
   *
   * Changes `get` to `getOptional`.
   */
  takeOptional<T extends PickQueryResultReturnType>(
    this: T,
  ): QueryTakeOptional<T> {
    return _queryTakeOptional(_clone(this)) as never;
  }

  /**
   * `.rows` returns an array of arrays without field names:
   *
   * ```ts
   * const rows: Array<Array<number | string>> = await db.table
   *   .select('id', 'name')
   *   .rows();
   *
   * rows.forEach((row) => {
   *   // row is array of column values
   *   row.forEach((value) => {
   *     // value is an id or a name
   *   });
   * });
   * ```
   */
  rows<T extends PickQueryResult>(this: T): SetQueryReturnsRows<T> {
    return _queryRows(_clone(this)) as never;
  }

  /**
   * `.pluck` returns a single array of a single selected column values:
   *
   * ```ts
   * const ids = await db.table.select('id').pluck();
   * // ids are an array of all users' id like [1, 2, 3]
   * ```
   * @param select - column name or a raw SQL
   */
  pluck<T extends PickQueryMeta, S extends SelectableOrExpression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    const q = _clone(this);
    q.q.returnType = 'pluck';

    const selected = addParserForSelectItem(
      q as never,
      q.q.as || q.table,
      'pluck',
      select,
    );
    (q.q as SelectQueryData).select = selected
      ? [selected as never]
      : undefined;
    return q as never;
  }

  /**
   * `.exec` won't parse the response at all, and returns undefined:
   *
   * ```ts
   * const nothing = await db.table.take().exec();
   * ```
   */
  exec<T>(this: T): SetQueryReturnsVoid<T> {
    return _queryExec(_clone(this)) as never;
  }

  /**
   * Call `toSQL` on a query to get an object with a `text` SQL string and a `values` array of binding values:
   *
   * ```ts
   * const sql = db.table.select('id', 'name').where({ name: 'name' }).toSQL();
   *
   * expect(sql.text).toBe(
   *   'SELECT "table"."id", "table"."name" FROM "table" WHERE "table"."name" = $1',
   * );
   * expect(sql.values).toEqual(['name']);
   * ```
   *
   * `toSQL` is called internally when awaiting a query.
   *
   * It is caching the result. Not mutating query methods are resetting the cache, but need to be careful with mutating methods that start with `_` - they won't reset the cache, which may lead to unwanted results.
   *
   * `toSQL` optionally accepts such parameters:
   *
   * ```ts
   * type ToSqlOptions = {
   *   values?: [];
   * };
   * ```
   */
  toSQL(this: ToSQLQuery, options?: ToSQLOptions): Sql {
    return toSQL(this, options);
  }

  /**
   * Adds a `DISTINCT` keyword to `SELECT`:
   *
   * ```ts
   * db.table.distinct().select('name');
   * ```
   *
   * Can accept column names or raw SQL expressions to place it to `DISTINCT ON (...)`:
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * // Distinct on the name and raw SQL
   * db.table.distinct('name', sql`raw sql`).select('id', 'name');
   * ```
   *
   * @param columns - column names or a raw SQL
   */
  distinct<T extends PickQueryMeta>(
    this: T,
    ...columns: SelectableOrExpressions<T>
  ): T {
    return pushQueryArrayImmutable(
      _clone(this),
      'distinct',
      columns as string[],
    ) as never;
  }

  /**
   * Finds a single record by the primary key (id), throws [NotFoundError](/guide/error-handling.html) if not found.
   * Not available if the table has no or multiple primary keys.
   *
   * ```ts
   * const result: TableType = await db.table.find(1);
   * ```
   *
   * @param value - primary key value to find by
   */
  find<T extends PickQueryShapeResultReturnTypeSinglePrimaryKey>(
    this: T,
    value: T['internal']['singlePrimaryKey'] | Expression,
  ): QueryTake<T> & QueryMetaHasWhere {
    const q = _clone(this);

    if (value === null || value === undefined) {
      throw new OrchidOrmInternalError(
        q,
        `${value} is not allowed in the find method`,
      );
    }

    return _queryTake(
      _queryWhere(q, [
        {
          [q.internal.singlePrimaryKey]: value,
        } as never,
      ]),
    ) as never;
  }

  /**
   * Finds a single record with a given SQL, throws {@link NotFoundError} if not found:
   *
   * ```ts
   * await db.user.findBySql`
   *   age = ${age} AND
   *   name = ${name}
   * `;
   * ```
   *
   * @param args - SQL expression
   */
  findBySql<T extends PickQueryResultReturnType>(
    this: T,
    ...args: SQLQueryArgs
  ): QueryTake<T> & QueryMetaHasWhere {
    const q = _clone(this);
    return _queryTake(_queryWhereSql(q, args)) as never;
  }

  /**
   * Finds a single record by the primary key (id), returns `undefined` when not found.
   * Not available if the table has no or multiple primary keys.
   *
   * ```ts
   * const result: TableType | undefined = await db.table.find(123);
   * ```
   *
   * @param value - primary key value to find by, or a raw SQL
   */
  findOptional<T extends PickQueryShapeResultReturnTypeSinglePrimaryKey>(
    this: T,
    value: T['internal']['singlePrimaryKey'] | Expression,
  ): QueryTakeOptional<T> & QueryMetaHasWhere {
    return _queryTakeOptional((this as unknown as Query).find(value)) as never;
  }

  /**
   * Finds a single record with a given SQL.
   * Returns `undefined` when not found.
   *
   * ```ts
   * await db.user.findBySqlOptional`
   *   age = ${age} AND
   *   name = ${name}
   * `;
   * ```
   *
   * @param args - SQL expression
   */
  findBySqlOptional<T extends PickQueryResultReturnType>(
    this: T,
    ...args: SQLQueryArgs
  ): QueryTakeOptional<T> & QueryMetaHasWhere {
    return _queryTakeOptional(
      (this as unknown as Query).findBySql(...args),
    ) as never;
  }

  /**
   * Finds a single unique record, throws [NotFoundError](/guide/error-handling.html) if not found.
   * It accepts values of primary keys or unique indexes defined on the table.
   * `findBy`'s argument type is a union of all possible sets of unique conditions.
   *
   * You can use `where(...).take()` for non-unique conditions.
   *
   * ```ts
   * await db.table.findBy({ key: 'value' });
   * ```
   *
   * @param uniqueColumnValues - is derived from primary keys and unique indexes in the table
   */
  findBy<T extends PickQueryResultReturnTypeUniqueColumns>(
    this: T,
    uniqueColumnValues: T['internal']['uniqueColumns'],
  ): QueryTake<T> & QueryMetaHasWhere {
    return _queryFindBy(_clone(this), [uniqueColumnValues] as never) as never;
  }

  /**
   * Finds a single unique record, returns `undefined` if not found.
   * It accepts values of primary keys or unique indexes defined on the table.
   * `findBy`'s argument type is a union of all possible sets of unique conditions.
   *
   * You can use `where(...).takeOptional()` for non-unique conditions.
   *
   * ```ts
   * await db.table.findByOptional({ key: 'value' });
   * ```
   *
   * @param uniqueColumnValues - is derived from primary keys and unique indexes in the table
   */
  findByOptional<T extends PickQueryResultReturnTypeUniqueColumns>(
    this: T,
    uniqueColumnValues: T['internal']['uniqueColumns'],
  ): QueryTakeOptional<T> & QueryMetaHasWhere {
    return _queryFindByOptional(_clone(this), [
      uniqueColumnValues,
    ] as never) as never;
  }

  /**
   * Specifies the schema to be used as a prefix of a table name.
   *
   * Though this method can be used to set the schema right when building the query,
   * it's better to specify schema when calling `db(table, () => columns, { schema: string })`
   *
   * ```ts
   * db.table.withSchema('customSchema').select('id');
   * ```
   *
   * Resulting SQL:
   *
   * ```sql
   * SELECT "user"."id" FROM "customSchema"."user"
   * ```
   *
   * @param schema - a name of the database schema to use
   */
  withSchema<T>(this: T, schema: string): T {
    const q = _clone(this);
    q.q.schema = schema;
    return q as T;
  }

  /**
   * For the `GROUP BY` SQL statement, it is accepting column names or raw expressions.
   *
   * `group` is useful when aggregating values.
   *
   * ```ts
   * // Select the category and sum of prices grouped by the category
   * const results = db.product
   *   .select('category')
   *   .selectSum('price', { as: 'sumPrice' })
   *   .group('category');
   * ```
   *
   * Also, it's possible to group by a selected value:
   *
   * ```ts
   * import { sql } from './baseTable';
   *
   * const results = db.product
   *   .select({
   *     month: sql`extract(month from "createdAt")`.type((t) =>
   *       // month is returned as string, parse it to int
   *       t.string().parse(parseInt),
   *     ),
   *   })
   *   .selectSum('price', { as: 'sumPrice' })
   *   // group by month extracted from "createdAt"
   *   .group('month');
   * ```
   *
   * Column aliases in `select` take precedence over table columns,
   * so if in the query above `db.product` had a column `month`,
   * the query would work in the exact same way, group by would reference the selected `month` expression.
   *
   * @param columns - column names or a raw SQL
   */
  group<T extends PickQueryMetaResult>(
    this: T,
    ...columns: T['meta']['hasSelect'] extends true
      ? GroupArgs<T>
      : { error: 'select is required for group' }[]
  ): T {
    return pushQueryArrayImmutable(_clone(this), 'group', columns) as never;
  }

  /**
   * Add a window with `window` and use it later by its name for aggregate or window functions:
   *
   * ```ts
   * db.table
   *   // define window `windowName`
   *   .window({
   *     windowName: {
   *       partitionBy: 'someColumn',
   *       order: {
   *         id: 'DESC',
   *       },
   *     },
   *   })
   *   .select({
   *     avg: (q) =>
   *       // calculate average price over the window
   *       q.avg('price', {
   *         // use window by its name
   *         over: 'windowName',
   *       }),
   *   });
   * ```
   *
   * @param arg - window config
   */
  window<T extends OrderArgSelf, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): WindowResult<T, W> {
    return pushQueryValueImmutable(_clone(this), 'window', arg) as never;
  }

  wrap<
    T extends PickQueryTableMetaResult,
    Q extends WrapQueryArg,
    As extends string = 't',
  >(this: T, query: Q, as?: As): SetQueryTableAlias<Q, As> {
    return queryWrap(this, _clone(query), as) as never;
  }

  /**
   * Adds an order by clause to the query.
   *
   * Takes one or more arguments, each argument can be a column name or an object.
   *
   * ```ts
   * db.table.order('id', 'name'); // ASC by default
   *
   * db.table.order({
   *   id: 'ASC', // or DESC
   *
   *   // to set nulls order:
   *   name: 'ASC NULLS FIRST',
   *   age: 'DESC NULLS LAST',
   * });
   * ```
   *
   * `order` can refer to the values returned from `select` sub-queries (unlike `where` which cannot).
   * So you can select a count of related records and order by it.
   *
   * For example, `comment` has many `likes`.
   * We are selecting few columns of `comment`, selecting `likesCount` by a sub-query in a select, and ordering comments by likes count:
   *
   * ```ts
   * db.comment
   *   .select('title', 'content', {
   *     likesCount: (q) => q.likes.count(),
   *   })
   *   .order({
   *     likesCount: 'DESC',
   *   });
   * ```
   *
   * @param args - column name(s) or an object with column names and sort directions.
   */
  order<T extends OrderArgSelf>(this: T, ...args: OrderArgs<T>): T {
    return pushQueryArrayImmutable(_clone(this), 'order', args) as never;
  }

  /**
   * Order by SQL expression
   *
   * Order by raw SQL expression.
   *
   * ```ts
   * db.table.orderSql`raw sql`;
   * ```
   *
   * @param args - SQL expression
   */
  orderSql<T>(this: T, ...args: SQLQueryArgs): T {
    return pushQueryValueImmutable(
      _clone(this),
      'order',
      sqlQueryArgsToExpression(args),
    ) as never;
  }

  /**
   * Adds a limit clause to the query.
   *
   * ```ts
   * db.table.limit(10);
   * ```
   *
   * @param arg - limit number
   */
  limit<T>(
    this: T,
    arg: T extends SubQueryReturningSingle
      ? 'Cannot apply limit on the query returning a single record'
      : number | undefined,
  ): T {
    const q = _clone(this);
    (q.q as SelectQueryData).limit = arg as number;
    return q as T;
  }

  /**
   * Adds an offset clause to the query.
   *
   * ```ts
   * db.table.offset(10);
   * ```
   *
   * @param arg - offset number
   */
  offset<T extends IsQuery>(this: T, arg: number | undefined): T {
    const q = _clone(this);
    (q.q as SelectQueryData).offset = arg;
    return q as never;
  }

  /**
   * Truncates the specified table.
   *
   * ```ts
   * // simply truncate
   * await db.table.truncate();
   *
   * // restart autoincrementing columns:
   * await db.table.truncate({ restartIdentity: true });
   *
   * // truncate also dependant tables:
   * await db.table.truncate({ cascade: true });
   * ```
   *
   * @param options - truncate options, may have `cascade: true` and `restartIdentity: true`
   */
  truncate<T extends PickQueryMeta>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoidKind<T, 'truncate'> {
    const query = _clone(this);
    const q = query.q as TruncateQueryData;
    q.type = 'truncate';
    if (options?.restartIdentity) {
      q.restartIdentity = true;
    }
    if (options?.cascade) {
      q.cascade = true;
    }
    return _queryExec(query) as never;
  }

  /**
   * `none` will resolve the query into an empty result, without executing a database query.
   *
   * ```ts
   * await db.table.none(); // -> empty array
   * await db.table.findOptional(123).none(); // -> undefined
   * await db.table.find(123).none(); // throws NotFoundError
   * ```
   *
   * [create](/guide/create-update-delete.html#create) chained with `count`, [update](/guide/create-update-delete.html#update), and [delete](/guide/create-update-delete.html#del-delete) are returning a count of affected records.
   *
   * When they are called with `none`, query does not execute and 0 is returned.
   *
   * ```ts
   * await db.table.insert(data); // -> 0
   * await db.table.all().update(data); // -> 0
   * await db.table.all().delete(); // -> 0
   * ```
   *
   * When it's being used in sub-selects, it will return empty arrays, `undefined`'s, or `0` for count,
   * or it will throw if the sub-query require a result:
   *
   * ```ts
   * await db.user.select({
   *   // returns empty array
   *   pets: (q) => q.pets.none(),
   *   // returns `undefined`
   *   firstPet: (q) => q.pets.none().takeOptional(),
   *   // throws NotFound error
   *   requriedFirstPet: (q) => q.pets.none().take(),
   *   // returns `undefined`
   *   firstPetName: (q) => q.pets.none().getOptional('name'),
   *   // throws NotFound error
   *   requiredFirstPetName: (q) => q.pets.none().get('name'),
   *   // returns empty array
   *   petsNames: (q) => q.pets.none().pluck('name'),
   *   // returns 0
   *   petsCount: (q) => q.pets.none().count(),
   * });
   * ```
   *
   * When the `none` query is being used for joins that require match, the host query will return an empty result:
   *
   * ```ts
   * // all the following queries will resolve into empty arrays
   *
   * await db.user.select({
   *   pets: (q) => q.pets.join().none(),
   * });
   *
   * await db.user.join((q) => q.pets.none());
   *
   * await db.user.join('pets', (q) => q.none());
   * ```
   *
   * When it's being used in `leftJoin` or `fullJoin`, it implicitly adds `ON false` into the join's SQL.
   *
   * ```ts
   * // this query can return user records
   * await db.user.leftJoin('pets', (q) => q.none());
   *
   * // this query won't return user records, because of the added where condition
   * await db.user.leftJoin('pets', (q) => q.none()).where({ 'pets.name': 'Kitty' });
   * ```
   */
  none<T>(this: T): T {
    return _queryNone(this);
  }

  /**
   * Use `makeHelper` to make a query helper - a function where you can modify the query, and reuse this function across different places.
   *
   * ```ts
   * const defaultAuthorSelect = db.author.makeHelper((q) => {
   *   return q.select('firstName', 'lastName');
   * });
   *
   * // this will select id, firstName, lastName with a correct TS type
   * // and return a single record
   * const result = await defaultAuthorSelect(db.author.select('id').find(1));
   * ```
   *
   * Such helper is available for relation queries inside `select`:
   *
   * ```ts
   * await db.book.select({
   *   author: (book) => defaultAuthorSelect(book.author),
   * });
   * ```
   *
   * Helper can accept additional arguments:
   *
   * ```ts
   * const selectFollowing = db.user.makeHelper((q, currentUser: { id: number }) => {
   *   return q.select({
   *     following: (q) =>
   *       q.followers.where({ followerId: currentUser.id }).exists(),
   *   });
   * });
   *
   * // select some columns and the `following` boolean field from users
   * await selectFollowing(db.user.select('id', 'name'), currentUser);
   * ```
   *
   * To get the result type of query helper, use `QueryHelperResult` type:
   *
   * ```ts
   * import { QueryHelperResult } from 'orchid-orm';
   *
   * const selectHelper = db.table.makeHelper((q) => q.select('id', 'name'));
   *
   * // This type is identical to `db.table.select('id', 'name')`
   * type SelectQuery = QueryHelperResult<typeof selectHelper>;
   *
   * // Await to get result, the type is `{ id: number, name: string }[]`
   * type Result = Awaited<QueryHelperResult<typeof selectHelper>>;
   * ```
   *
   * @param fn - helper function
   */
  makeHelper<T extends PickQueryMetaShape, Args extends unknown[], Result>(
    this: T,
    fn: (q: T, ...args: Args) => Result,
  ): QueryHelper<T, Args, Result> {
    const as =
      (this as unknown as Query).q.as ||
      ((this as unknown as Query).table as string);

    return ((query: T, ...args: Args) => {
      const q = _clone(query);
      // alias the original table name inside the makeHelper with dynamic table name from the invoking code
      if (q.q.as) {
        setQueryObjectValueImmutable(q, 'aliases', as, q.q.as);
      }
      return fn(q as never, ...args);
    }) as never;
  }

  /**
   * `modify` allows modifying the query with helpers defined with {@link makeHelper}:
   *
   * ```ts
   * const helper = db.table.makeHelper((q) => {
   *   // all query methods are available
   *   return q.select('name').where({ active: true }).order({ createdAt: 'DESC' });
   * });
   *
   * const record = await db.table.select('id').modify(helper).find(1);
   *
   * record.id; // id was selected before `modify`
   * record.name; // name was selected by the function
   * ```
   *
   * When the helper result isn't certain, it will result in a union of all possibilities.
   * Use this sparingly as it complicates dealing with the result.
   *
   * ```ts
   * const helper = db.table((q) => {
   *   if (Math.random() > 0.5) {
   *     return q.select('one');
   *   } else {
   *     return q.select('two');
   *   }
   * });
   *
   * const record = await db.table.modify(helper).find(1);
   *
   * // TS error: we don't know for sure if the `one` was selected.
   * record.one;
   *
   * // use `in` operator to disambiguate the result type
   * if ('one' in record) {
   *   record.one;
   * } else {
   *   record.two;
   * }
   * ```
   *
   * You can define and pass parameters:
   *
   * ```ts
   * const helper = db.table.makeHelper((q, select: 'id' | 'name') => {
   *   return q.select(select);
   * });
   *
   * const record = await db.table.modify(helper, 'id').find(1);
   * // record has type { id: number } | { name: string }
   * if ('id' in record) {
   *   record.id;
   * }
   * ```
   *
   * @param fn - function to modify the query with. The result type will be merged with the main query as if the `merge` method was used.
   */
  modify<
    T extends PickQueryTableMetaResultReturnTypeWithDataWindowsThen,
    Fn extends IsQueryHelperForTable<T['table']>,
  >(
    this: T,
    fn: Fn,
    ...args: Fn['args']
  ): Fn['result'] extends PickQueryMetaResultReturnTypeWithDataWindowsThen
    ? MergeQuery<T, Fn['result']>
    : Fn['result'] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (fn as any)(this as never, ...args);
  }

  /**
   * Narrows a part of the query output type.
   * Use with caution, type-safety isn't guaranteed with it.
   * This is similar so using `as` keyword from TypeScript, except that it applies only to a part of the result.
   *
   * The syntax `()<{ ... }>()` is enforced by internal limitations.
   *
   * ```ts
   * const rows = db.table
   *   // filter out records where the `nullableColumn` is null
   *   .where({ nullableColumn: { not: null } });
   *   // narrows only a specified column, the rest of result is unchanged
   *   .narrowType()<{ nullableColumn: string }>()
   *
   * // the column had type `string | null`, now it is `string`
   * rows[0].nullableColumn
   *
   * // imagine that table has a enum column kind with variants 'first' | 'second'
   * // and a boolean `approved`
   * db.table
   *   .where({ kind: 'first', approved: true })
   *   // after applying such `where`, it's safe to narrow the type to receive the literal values
   *   .narrowType()<{ kind: 'first', approved: true }>();
   * ```
   */
  narrowType<T extends NarrowTypeSelf>(
    this: T,
  ): <Narrow>() => T['returnType'] extends
    | undefined
    | 'all'
    | 'one'
    | 'oneOrThrow'
    ? [NarrowInvalidKeys<T, Narrow>] extends [never]
      ? {
          [K in keyof T]: K extends 'result'
            ? T['result'] & {
                [K in keyof Narrow]: {
                  outputType: Narrow[K];
                };
              }
            : K extends 'then'
            ? QueryThenByQuery<
                T,
                T['result'] & {
                  [K in keyof Narrow]: {
                    outputType: Narrow[K];
                  };
                }
              >
            : T[K];
        }
      : `narrowType() error: provided type does not extend the '${NarrowInvalidKeys<
          T,
          Narrow
        > &
          string}' column type`
    : (
        T['returnType'] extends 'pluck'
          ? Narrow extends unknown[]
            ? Narrow[number]
            : Narrow
          : Narrow
      ) extends (
        T['returnType'] extends 'pluck'
          ? T['result']['pluck']['outputType']
          : T['result']['value']['outputType']
      )
    ? {
        [K in keyof T]: K extends 'result'
          ? T['returnType'] extends 'value' | 'valueOrThrow'
            ? NarrowValueTypeResult<T, Narrow>
            : NarrowPluckTypeResult<T, Narrow>
          : K extends 'then'
          ? QueryThenByQuery<
              T,
              T['returnType'] extends 'value' | 'valueOrThrow'
                ? NarrowValueTypeResult<T, Narrow>
                : NarrowPluckTypeResult<T, Narrow>
            >
          : T[K];
      }
    : 'narrowType() error: provided type does not extend the returning column column type' {
    return () => this as never;
  }

  if<T extends PickQueryMetaResultReturnType, R extends PickQueryResult>(
    this: T,
    condition: boolean | null | undefined,
    fn: (q: T) => R & { returnType: T['returnType'] },
  ): QueryIfResult<T, R> {
    return (condition ? fn(this) : this) as never;
  }

  queryRelated<
    T extends PickQueryRelations,
    RelName extends keyof T['relations'],
  >(
    this: T,
    relName: RelName,
    params: T['relations'][RelName]['params'],
  ): T['relations'][RelName]['maybeSingle'] {
    return this.relations[relName as string].queryRelated(params) as never;
  }

  chain<
    T extends PickQueryMetaShapeRelationsReturnType,
    RelName extends keyof T['relations'],
  >(
    this: T,
    relName: RelName,
  ): [
    T['meta']['subQuery'],
    T['returnType'],
    T['relations'][RelName]['returnsOne'],
  ] extends [true, 'one' | 'oneOrThrow', true]
    ? {
        [K in keyof T['relations'][RelName]['maybeSingle']]: K extends 'meta'
          ? {
              [K in keyof T['relations'][RelName]['maybeSingle']['meta']]: K extends 'selectable'
                ? T['relations'][RelName]['maybeSingle']['meta']['selectable'] &
                    Omit<T['meta']['selectable'], keyof T['shape']>
                : K extends 'subQuery'
                ? true
                : T['relations'][RelName]['maybeSingle']['meta'][K];
            }
          : T['relations'][RelName]['maybeSingle'][K];
      }
    : JoinResultRequireMain<
        T['relations'][RelName]['query'],
        Omit<T['meta']['selectable'], keyof T['shape']>
      > {
    const rel = this.relations[relName as string];

    return _chain(this as unknown as IsQuery, _clone(rel.query), rel) as never;
  }
}

Object.assign(QueryMethods.prototype, QueryUpsert);
Object.assign(QueryMethods.prototype, QueryOrCreate);

applyMixins(QueryMethods, [
  AsMethods,
  AggregateMethods,
  Select,
  FromMethods,
  Join,
  OnMethods,
  WithMethods,
  Union,
  JsonMethods,
  QueryCreate,
  Update,
  Delete,
  Transaction,
  For,
  Where,
  SearchMethods,
  Clear,
  Having,
  Then,
  QueryLog,
  QueryHooks,
  QueryGet,
  MergeQueryMethods,
  SqlMethod,
  TransformMethods,
  QueryMap,
  ScopeMethods,
  SoftDeleteMethods,
  ExpressionMethods,
]);
