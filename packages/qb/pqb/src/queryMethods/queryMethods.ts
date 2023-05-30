import {
  Query,
  SetQueryReturnsAll,
  SetQueryReturnsColumn,
  SetQueryReturnsOne,
  SetQueryReturnsOneOptional,
  SetQueryReturnsPluck,
  SetQueryReturnsRows,
  SetQueryReturnsVoid,
  SetQueryTableAlias,
} from '../query';
import { Expression } from '../utils';
import {
  SelectItem,
  SelectQueryData,
  SortDir,
  toSql,
  ToSqlOptions,
  TruncateQueryData,
} from '../sql';
import { pushQueryArray, pushQueryValue } from '../queryDataUtils';
import { Then } from './then';
import { BooleanColumn } from '../columns';
import { Aggregate } from './aggregate';
import { addParserForSelectItem, Select } from './select';
import { From } from './from';
import { Join, OnQueryBuilder } from './join';
import { With } from './with';
import { Union } from './union';
import { Json } from './json';
import { Create } from './create';
import { Update } from './update';
import { Delete } from './delete';
import { Transaction } from './transaction';
import { For } from './for';
import { ColumnInfoMethods } from './columnInfo';
import { addWhere, Where, WhereArg, WhereResult } from './where';
import { Clear } from './clear';
import { Having } from './having';
import { Window } from './window';
import { QueryLog } from './log';
import { QueryHooks } from './hooks';
import { QueryUpsertOrCreate } from './upsertOrCreate';
import { QueryGet } from './get';
import { MergeQuery, MergeQueryMethods } from './merge';
import { RawSqlMethods } from './rawSql';
import { CopyMethods } from './copy';
import {
  RawExpression,
  raw,
  applyMixins,
  EmptyObject,
  Sql,
  QueryThen,
  ColumnsShapeBase,
} from 'orchid-core';
import { AsMethods } from './as';
import { QueryBase } from '../queryBase';
import { OrchidOrmInternalError } from '../errors';

// argument of the window method
// it is an object where keys are name of windows
// and values can be a window options or a raw SQL
export type WindowArg<T extends Query> = Record<
  string,
  WindowArgDeclaration<T> | RawExpression
>;

// SQL window options to specify partitionBy and order of the window
export type WindowArgDeclaration<T extends Query = Query> = {
  partitionBy?: Expression<T> | Expression<T>[];
  order?: OrderArg<T>;
};

// add new windows to a query
type WindowResult<T extends Query, W extends WindowArg<T>> = T & {
  windows: Record<keyof W, true>;
};

export type OrderArg<
  T extends Query,
  Key extends PropertyKey =
    | keyof T['selectable']
    | {
        [K in keyof T['result']]: T['result'][K]['dataType'] extends
          | 'array'
          | 'object'
          ? never
          : K;
      }[keyof T['result']],
> =
  | Key
  | {
      [K in Key]?: SortDir;
    }
  | RawExpression;

export type OrderArgs<T extends Query> =
  | OrderArg<T>[]
  | [TemplateStringsArray, ...unknown[]];

type FindArgs<T extends Query> =
  | [T['shape'][T['singlePrimaryKey']]['type'] | RawExpression]
  | [TemplateStringsArray, ...unknown[]];

type QueryHelper<T extends Query, Args extends unknown[], Result> = <
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
) => Result extends Query ? MergeQuery<Q, Result> : Result;

export interface QueryMethods
  extends Omit<AsMethods, 'result'>,
    Aggregate,
    Select,
    From,
    Join,
    With,
    Union,
    Json,
    Create,
    Update,
    Delete,
    Transaction,
    For,
    ColumnInfoMethods,
    Omit<Where, 'result'>,
    Clear,
    Having,
    Window,
    Then,
    QueryLog,
    QueryHooks,
    QueryUpsertOrCreate,
    QueryGet,
    MergeQueryMethods,
    RawSqlMethods,
    CopyMethods {}

export class QueryMethods {
  windows!: EmptyObject;
  baseQuery!: Query;

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
    this.query.returnType = 'all';
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
    this.query.returnType = 'oneOrThrow';
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
    this.query.returnType = 'one';
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
    this.query.returnType = 'rows';
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
  pluck<T extends Query, S extends Expression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    return this.clone()._pluck(select);
  }
  _pluck<T extends Query, S extends Expression<T>>(
    this: T,
    select: S,
  ): SetQueryReturnsPluck<T, S> {
    this.query.returnType = 'pluck';
    (this.query as SelectQueryData).select = [select as SelectItem];
    addParserForSelectItem(this, this.query.as || this.table, 'pluck', select);
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
    this.query.returnType = 'void';
    return this as unknown as SetQueryReturnsVoid<T>;
  }

  toSql(this: Query, options?: ToSqlOptions): Sql {
    return toSql(this, options);
  }

  distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return this.clone()._distinct(...columns);
  }
  _distinct<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return pushQueryArray(this, 'distinct', columns as string[]);
  }

  /**
   * Find a single record by the primary key (id), adds `LIMIT 1`.
   * Throws when not found.
   *
   * ```ts
   * const result: TableType = await db.table.find(123);
   * ```
   *
   * @param args - primary key value to find by
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
      return this._find(raw(args as [TemplateStringsArray, ...unknown[]]));
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
   * Find a single record by the primary key (id), adds `LIMIT 1`.
   * Returns `undefined` when not found.
   *
   * ```ts
   * const result: TableType | undefined = await db.table.find(123);
   * ```
   *
   * @param args - primary key value to find by
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
   * Throws when not found.
   *
   * ```ts
   * const result: TableType = await db.table.findBy({
   *   key: 'value',
   * });
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

  withSchema<T extends Query>(this: T, schema: string): T {
    return this.clone()._withSchema(schema);
  }
  _withSchema<T extends Query>(this: T, schema: string): T {
    this.query.schema = schema;
    return this;
  }

  group<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return this.clone()._group(...columns);
  }
  _group<T extends Query>(this: T, ...columns: Expression<T>[]): T {
    return pushQueryArray(this, 'group', columns);
  }

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

  order<T extends Query>(this: T, ...args: OrderArgs<T>): T {
    return this.clone()._order(...args);
  }
  _order<T extends Query>(this: T, ...args: OrderArgs<T>): T {
    if (Array.isArray(args[0])) {
      return this._order(raw(args as [TemplateStringsArray, ...unknown[]]));
    }
    return pushQueryArray(this, 'order', args);
  }

  limit<T extends Query>(this: T, arg: number | undefined): T {
    return this.clone()._limit(arg);
  }
  _limit<T extends Query>(this: T, arg: number | undefined): T {
    (this.query as SelectQueryData).limit = arg;
    return this;
  }

  offset<T extends Query>(this: T, arg: number | undefined): T {
    return this.clone()._offset(arg);
  }
  _offset<T extends Query>(this: T, arg: number | undefined): T {
    (this.query as SelectQueryData).offset = arg;
    return this;
  }

  exists<T extends Query>(this: T): SetQueryReturnsColumn<T, BooleanColumn> {
    return this.clone()._exists();
  }
  _exists<T extends Query>(this: T): SetQueryReturnsColumn<T, BooleanColumn> {
    const q = this._getOptional(raw('true'));
    q.query.notFoundDefault = false;
    q.query.coalesceValue = raw('false');
    return q as unknown as SetQueryReturnsColumn<T, BooleanColumn>;
  }

  truncate<T extends Query>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoid<T> {
    return this.clone()._truncate(options);
  }
  _truncate<T extends Query>(
    this: T,
    options?: { restartIdentity?: boolean; cascade?: boolean },
  ): SetQueryReturnsVoid<T> {
    const q = this.query as TruncateQueryData;
    q.type = 'truncate';
    if (options?.restartIdentity) {
      q.restartIdentity = true;
    }
    if (options?.cascade) {
      q.cascade = true;
    }
    return this._exec();
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
   * @param fn - helper function
   */
  makeHelper<T extends Query, Args extends unknown[], Result>(
    this: T,
    fn: (q: T, ...args: Args) => Result,
  ): QueryHelper<T, Args, Result> {
    return fn as unknown as QueryHelper<T, Args, Result>;
  }
}

applyMixins(QueryMethods, [
  QueryBase,
  AsMethods,
  Aggregate,
  Select,
  From,
  Join,
  OnQueryBuilder,
  With,
  Union,
  Json,
  Create,
  Update,
  Delete,
  Transaction,
  For,
  ColumnInfoMethods,
  Where,
  Clear,
  Having,
  Window,
  Then,
  QueryLog,
  QueryHooks,
  QueryUpsertOrCreate,
  QueryGet,
  MergeQueryMethods,
  RawSqlMethods,
  CopyMethods,
]);
