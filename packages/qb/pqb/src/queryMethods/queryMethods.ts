import {
  Query,
  SetQueryKind,
  SetQueryReturnsAll,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  SetQueryReturnsPluck,
  SetQueryReturnsRows,
  SetQueryReturnsVoid,
  SetQueryTableAlias,
} from '../query/query';
import { SelectableOrExpression } from '../common/utils';
import {
  OrderTsQueryConfig,
  SelectItem,
  SelectQueryData,
  SortDir,
  toSQL,
  ToSQLCtx,
  ToSQLOptions,
  TruncateQueryData,
} from '../sql';
import {
  extendQuery,
  pushQueryArray,
  pushQueryValue,
} from '../query/queryUtils';
import { Then } from './then';
import { AggregateMethods } from './aggregate';
import { addParserForSelectItem, Select } from './select';
import { From } from './from';
import { Join, OnQueryBuilder } from './join/join';
import { With } from './with';
import { Union } from './union';
import { JsonModifiers, JsonMethods } from './json';
import { Create } from './create';
import { Update } from './update';
import { Delete } from './delete';
import { Transaction } from './transaction';
import { For } from './for';
import { ColumnInfoMethods } from './columnInfo';
import { addWhere, Where, WhereArg, WhereResult } from './where/where';
import { SearchMethods } from './search';
import { Clear } from './clear';
import { Having } from './having';
import { QueryLog } from './log';
import { QueryHooks } from './hooks';
import { QueryUpsertOrCreate } from './upsertOrCreate';
import { QueryGet } from './get';
import { MergeQuery, MergeQueryMethods } from './merge';
import { RawSqlMethods } from './rawSql';
import { CopyMethods } from './copy';
import {
  applyMixins,
  Sql,
  QueryThen,
  ColumnsShapeBase,
  TemplateLiteralArgs,
  Expression,
  ColumnTypeBase,
} from 'orchid-core';
import { AsMethods } from './as';
import { QueryBase } from '../query/queryBase';
import { OrchidOrmInternalError } from '../errors';
import { TransformMethods } from './transform';
import { RawSQL } from '../sql/rawSql';
import { noneMethods } from './none';
import { simpleExistingColumnToSQL } from '../sql/common';
import { ScopeMethods } from './scope';

// argument of the window method
// it is an object where keys are name of windows
// and values can be a window options or a raw SQL
export type WindowArg<T extends Query> = Record<
  string,
  WindowArgDeclaration<T> | Expression
>;

// SQL window options to specify partitionBy and order of the window
export type WindowArgDeclaration<T extends Query = Query> = {
  partitionBy?: SelectableOrExpression<T> | SelectableOrExpression<T>[];
  order?: OrderArg<T>;
};

// add new windows to a query
type WindowResult<T extends Query, W extends WindowArg<T>> = T & {
  windows: Record<keyof W, true>;
};

export type OrderArg<
  T extends Query,
  TsQuery extends PropertyKey = string | undefined extends T['meta']['tsQuery']
    ? never
    : Exclude<T['meta']['tsQuery'], undefined>,
  Key extends PropertyKey =
    | keyof T['selectable']
    | {
        [K in keyof T['result']]: T['result'][K]['dataType'] extends
          | 'array'
          | 'object'
          ? never
          : K;
      }[keyof T['result']]
    | TsQuery,
> =
  | Key
  | {
      [K in Key]?: K extends TsQuery ? OrderTsQueryConfig : SortDir;
    }
  | Expression;

export type OrderArgs<T extends Query> = OrderArg<T>[] | TemplateLiteralArgs;

export type GroupArg<T extends Query> =
  | {
      [K in keyof T['result']]: T['result'][K]['dataType'] extends
        | 'array'
        | 'object'
        ? never
        : K;
    }[keyof T['result']]
  | Expression;

type FindArgs<T extends Query> =
  | [T['shape'][T['singlePrimaryKey']]['queryType'] | Expression]
  | TemplateLiteralArgs;

type QueryHelper<T extends Query, Args extends unknown[], Result> = {
  <
    Q extends {
      [K in keyof T]: K extends 'then'
        ? QueryThen<unknown>
        : K extends 'result'
        ? ColumnsShapeBase
        : T[K];
    },
  >(
    q: Q,
    ...args: Args
  ): Result extends Query ? MergeQuery<Q, Result> : Result;

  result: Result;
};

// Get result of query helper, for https://github.com/romeerez/orchid-orm/issues/215
export type QueryHelperResult<
  T extends QueryHelper<Query, unknown[], unknown>,
> = T['result'];

// Result of `truncate` method: query has kind 'truncate' and returns nothing.
type TruncateResult<T extends Query> = SetQueryKind<
  SetQueryReturnsVoid<T>,
  'truncate'
>;

// Expression created by `Query.column('name')`, it will prefix the column with a table name from query's context.
export class ColumnRefExpression<
  T extends ColumnTypeBase,
> extends Expression<T> {
  constructor(public _type: T, public name: string) {
    super();
  }

  makeSQL(ctx: ToSQLCtx, quotedAs?: string): string {
    return simpleExistingColumnToSQL(ctx, this.name, this._type, quotedAs);
  }
}

export interface QueryMethods<ColumnTypes>
  extends Omit<AsMethods, 'result'>,
    AggregateMethods,
    Select,
    From,
    Join,
    With,
    Union,
    Omit<JsonModifiers, 'result'>,
    JsonMethods,
    Create,
    Update,
    Delete,
    Transaction,
    For,
    ColumnInfoMethods,
    Omit<Where, 'result'>,
    SearchMethods,
    Clear,
    Having,
    Then,
    QueryLog,
    Omit<QueryHooks, 'result'>,
    QueryUpsertOrCreate,
    QueryGet,
    MergeQueryMethods,
    RawSqlMethods<ColumnTypes>,
    CopyMethods,
    TransformMethods,
    ScopeMethods {}

export class QueryMethods<ColumnTypes> {
  /**
   * `.all` is a default behavior, that returns an array of objects:
   *
   * ```ts
   * const records = db.table
   *   .take() // .take() will be overridden by .all()
   *   .all();
   * ```
   */
  all<T extends Query>(this: T): SetQueryReturnsAll<T> {
    return this.clone()._all();
  }
  _all<T extends Query>(this: T): SetQueryReturnsAll<T> {
    this.q.returnType = 'all';
    this.q.and ??= [];
    return this as unknown as SetQueryReturnsAll<T>;
  }

  /**
   * Takes a single record, adds `LIMIT 1`.
   * Throws when not found.
   *
   * ```ts
   * const result: TableType = await db.table.where({ key: 'value' }).take();
   * ```
   */
  take<T extends Query>(this: T): SetQueryReturnsOne<T> {
    return this.clone()._take();
  }
  _take<T extends Query>(this: T): SetQueryReturnsOne<T> {
    this.q.returnType = 'oneOrThrow';
    return this as unknown as SetQueryReturnsOne<T>;
  }

  /**
   * Takes a single record, adds `LIMIT 1`.
   * Returns `undefined` when not found.
   *
   * ```ts
   * const result: TableType | undefined = await db.table
   *   .where({ key: 'value' })
   *   .takeOptional();
   * ```
   */
  takeOptional<T extends Query>(this: T): SetQueryReturnsOneOptional<T> {
    return this.clone()._takeOptional();
  }
  _takeOptional<T extends Query>(this: T): SetQueryReturnsOneOptional<T> {
    this.q.returnType = 'one';
    return this as unknown as SetQueryReturnsOneOptional<T>;
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
  rows<T extends Query>(this: T): SetQueryReturnsRows<T> {
    return this.clone()._rows();
  }
  _rows<T extends Query>(this: T): SetQueryReturnsRows<T> {
    this.q.returnType = 'rows';
    return this as unknown as SetQueryReturnsRows<T>;
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
  pluck<T extends Query, S extends SelectableOrExpression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    return this.clone()._pluck(select);
  }
  _pluck<T extends Query, S extends SelectableOrExpression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    this.q.returnType = 'pluck';
    (this.q as SelectQueryData).select = [select as SelectItem];
    addParserForSelectItem(this, this.q.as || this.table, 'pluck', select);
    return this as unknown as SetQueryReturnsPluck<T, S>;
  }

  /**
   * `.exec` won't parse the response at all, and returns undefined:
   *
   * ```ts
   * const nothing = await db.table.take().exec();
   * ```
   */
  exec<T extends Query>(this: T): SetQueryReturnsVoid<T> {
    return this.clone()._exec();
  }
  _exec<T extends Query>(this: T): SetQueryReturnsVoid<T> {
    this.q.returnType = 'void';
    return this as unknown as SetQueryReturnsVoid<T>;
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
   *   clearCache?: true;
   *   values?: [];
   * };
   * ```
   */
  toSQL(this: Query, options?: ToSQLOptions): Sql {
    return toSQL(this, options);
  }

  /**
   * Adds a `DISTINCT` keyword to `SELECT`:
   *
   * ```ts
   * db.table.distinct().select('name');
   * ```
   *
   * Can accept column names or raw expressions to place it to `DISTINCT ON (...)`:
   *
   * ```ts
   * // Distinct on the name and raw SQL
   * db.table.distinct('name', db.table.sql`raw sql`).select('id', 'name');
   * ```
   *
   * @param columns - column names or a raw SQL
   */
  distinct<T extends Query>(
    this: T,
    ...columns: SelectableOrExpression<T>[]
  ): T {
    return this.clone()._distinct(...columns);
  }
  _distinct<T extends Query>(
    this: T,
    ...columns: SelectableOrExpression<T>[]
  ): T {
    return pushQueryArray(this, 'distinct', columns as string[]);
  }

  /**
   * The `find` method is available only for tables which has exactly one primary key.
   * And also it can accept raw SQL template literal, then the primary key is not required.
   *
   * Find record by id, throw [NotFoundError](/guide/error-handling.html) if not found:
   *
   * ```ts
   * await db.table.find(1);
   * ```
   *
   * ```ts
   * await db.user.find`
   *   age = ${age} AND
   *   name = ${name}
   * `;
   * ```
   *
   * @param args - primary key value to find by, or a raw SQL
   */
  find<T extends Query>(
    this: T,
    ...args: FindArgs<T>
  ): SetQueryReturnsOne<WhereResult<T>> {
    return this.clone()._find(...args);
  }
  _find<T extends Query>(
    this: T,
    ...args: FindArgs<T>
  ): SetQueryReturnsOne<WhereResult<T>> {
    const [value] = args;
    if (Array.isArray(value)) {
      return this._find(new RawSQL(args as TemplateLiteralArgs));
    }

    if (value === null || value === undefined) {
      throw new OrchidOrmInternalError(
        this,
        `${value} is not allowed in the find method`,
      );
    }

    return this._where({
      [this.singlePrimaryKey]: value,
    } as WhereArg<T>)._take();
  }

  /**
   * Find a single record by the primary key (id), adds `LIMIT 1`, can accept a raw SQL.
   * Returns `undefined` when not found.
   *
   * ```ts
   * const result: TableType | undefined = await db.table.find(123);
   * ```
   *
   * @param args - primary key value to find by, or a raw SQL
   */
  findOptional<T extends Query>(
    this: T,
    ...args: FindArgs<T>
  ): SetQueryReturnsOneOptional<WhereResult<T>> {
    return this.clone()._findOptional(...args);
  }
  _findOptional<T extends Query>(
    this: T,
    ...args: FindArgs<T>
  ): SetQueryReturnsOneOptional<WhereResult<T>> {
    return this._find(
      ...args,
    ).takeOptional() as unknown as SetQueryReturnsOneOptional<WhereResult<T>>;
  }

  /**
   * The same as `where(conditions).take()`, it will filter records and add a `LIMIT 1`.
   * Throws `NotFoundError` if not found.
   *
   * ```ts
   * const result: TableType = await db.table.findBy({ key: 'value' });
   * // is equivalent to:
   * db.table.where({ key: 'value' }).take()
   * ```
   *
   * @param args - `where` conditions
   */
  findBy<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOne<WhereResult<T>> {
    return this.clone()._findBy(...args);
  }
  _findBy<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOne<WhereResult<T>> {
    return addWhere(this, args).take();
  }

  /**
   * The same as `where(conditions).takeOptional()`, it will filter records and add a `LIMIT 1`.
   * Returns `undefined` when not found.
   *
   * ```ts
   * const result: TableType | undefined = await db.table.findByOptional({
   *   key: 'value',
   * });
   * ```
   *
   * @param args - `where` conditions
   */
  findByOptional<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOneOptional<WhereResult<T>> {
    return this.clone()._findByOptional(...args);
  }
  _findByOptional<T extends Query>(
    this: T,
    ...args: WhereArg<T>[]
  ): SetQueryReturnsOneOptional<WhereResult<T>> {
    return addWhere(this, args).takeOptional();
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
  withSchema<T extends Query>(this: T, schema: string): T {
    return this.clone()._withSchema(schema);
  }
  _withSchema<T extends Query>(this: T, schema: string): T {
    this.q.schema = schema;
    return this;
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
   * const results = db.product
   *   .select({
   *     month: db.product.sql`extract(month from "createdAt")`.type((t) =>
   *       // month is returned as string, parse it to int
   *       t.string().parse(parseInt),
   *     ),
   *   })
   *   .selectSum('price', { as: 'sumPrice' })
   *   // group by month extracted from "createdAt"
   *   .group('month');
   * ```
   *
   * @param columns - column names or a raw SQL
   */
  group<T extends Query>(this: T, ...columns: GroupArg<T>[]): T {
    return this.clone()._group(...columns);
  }
  _group<T extends Query>(this: T, ...columns: GroupArg<T>[]): T {
    return pushQueryArray(this, 'group', columns);
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
  window<T extends Query, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): WindowResult<T, W> {
    return this.clone()._window(arg);
  }
  _window<T extends Query, W extends WindowArg<T>>(
    this: T,
    arg: W,
  ): WindowResult<T, W> {
    return pushQueryValue(this, 'window', arg) as unknown as WindowResult<T, W>;
  }

  wrap<T extends Query, Q extends Query, As extends string = 't'>(
    this: T,
    query: Q,
    as?: As,
  ): SetQueryTableAlias<Q, As> {
    return this.clone()._wrap(query, as);
  }
  _wrap<T extends Query, Q extends Query, As extends string = 't'>(
    this: T,
    query: Q,
    as: As = 't' as As,
  ): SetQueryTableAlias<Q, As> {
    return (query._from(this) as Query)._as(
      as,
    ) as unknown as SetQueryTableAlias<Q, As>;
  }

  /**
   * Adds an order by clause to the query.
   *
   * Takes one or more arguments, each argument can be a column name, an object, or a raw expression.
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
   *
   * // order by raw SQL expression:
   * db.table.order`raw sql`;
   * // or
   * db.table.order(db.table.sql`raw sql`);
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
   * @param args - column name(s), raw SQL, or an object with column names and sort directions.
   */
  order<T extends Query>(this: T, ...args: OrderArgs<T>): T {
    return this.clone()._order(...args);
  }
  _order<T extends Query>(this: T, ...args: OrderArgs<T>): T {
    if (Array.isArray(args[0])) {
      return this._order(new RawSQL(args as TemplateLiteralArgs));
    }
    return pushQueryArray(this, 'order', args);
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
  limit<T extends Query>(this: T, arg: number | undefined): T {
    return this.clone()._limit(arg);
  }
  _limit<T extends Query>(this: T, arg: number | undefined): T {
    (this.q as SelectQueryData).limit = arg;
    return this;
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
  offset<T extends Query>(this: T, arg: number | undefined): T {
    return this.clone()._offset(arg);
  }
  _offset<T extends Query>(this: T, arg: number | undefined): T {
    (this.q as SelectQueryData).offset = arg;
    return this;
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
  truncate<T extends Query>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): TruncateResult<T> {
    return this.clone()._truncate(options);
  }
  _truncate<T extends Query>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): TruncateResult<T> {
    const q = this.q as TruncateQueryData;
    q.type = 'truncate';
    if (options?.restartIdentity) {
      q.restartIdentity = true;
    }
    if (options?.cascade) {
      q.cascade = true;
    }
    return this._exec() as TruncateResult<T>;
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
   */
  none<T extends Query>(this: T): T {
    return extendQuery(this, noneMethods);
  }

  /**
   * `modify` allows modifying the query with your function:
   *
   * ```ts
   * const doSomethingWithQuery = (q: typeof db.table) => {
   *   // can use all query methods
   *   return q.select('name').where({ active: true }).order({ createdAt: 'DESC' });
   * };
   *
   * const record = await db.table.select('id').modify(doSomethingWithQuery).find(1);
   *
   * record.id; // id was selected before `modify`
   * record.name; // name was selected by the function
   * ```
   *
   * It's possible to apply different `select`s inside the function, and then the result type will be a union of all possibilities:
   *
   * Use this sparingly as it complicates dealing with the result.
   *
   * ```ts
   * const doSomethingWithQuery = (q: typeof db.table) => {
   *   if (Math.random() > 0.5) {
   *     return q.select('one');
   *   } else {
   *     return q.select('two');
   *   }
   * };
   *
   * const record = await db.table.modify(doSomethingWithQuery).find(1);
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
   * @param fn - function to modify the query with. The result type will be merged with the main query as if the `merge` method was used.
   */
  modify<T extends Query, Arg extends Query & { table: T['table'] }, Result>(
    this: T,
    fn: (q: Arg) => Result,
  ): Result extends Query ? MergeQuery<T, Result> : Result {
    return fn(this as unknown as Arg) as Result extends Query
      ? MergeQuery<T, Result>
      : Result;
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
  makeHelper<T extends Query, Args extends unknown[], Result>(
    this: T,
    fn: (q: T, ...args: Args) => Result,
  ): QueryHelper<T, Args, Result> {
    return fn as unknown as QueryHelper<T, Args, Result>;
  }

  /**
   * Use `column` method to interpolate column names inside SQL templates.
   * The column will be prefixed with the correct table name taken from the context of the query.
   *
   * ```ts
   * db.table.sql`${db.table.column('id')} = 1`;
   * ```
   *
   * @param name
   */
  column<T extends Query, K extends keyof T['shape']>(
    this: T,
    name: K,
  ): ColumnRefExpression<T['shape'][K]> {
    const column = (this.shape as Record<PropertyKey, ColumnTypeBase>)[name];
    return new ColumnRefExpression(column as T['shape'][K], name as string);
  }
}

applyMixins(QueryMethods, [
  QueryBase,
  AsMethods,
  AggregateMethods,
  Select,
  From,
  Join,
  OnQueryBuilder,
  With,
  Union,
  JsonModifiers,
  JsonMethods,
  Create,
  Update,
  Delete,
  Transaction,
  For,
  ColumnInfoMethods,
  Where,
  SearchMethods,
  Clear,
  Having,
  Then,
  QueryLog,
  QueryHooks,
  QueryUpsertOrCreate,
  QueryGet,
  MergeQueryMethods,
  RawSqlMethods,
  CopyMethods,
  TransformMethods,
  ScopeMethods,
]);
