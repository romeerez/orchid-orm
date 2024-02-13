import { Query, SelectableFromShape } from './query';
import {
  QueryMethods,
  handleResult,
  OnQueryBuilder,
  logParamToLogObject,
  QueryLogOptions,
} from '../queryMethods';
import { QueryData, QueryScopes, SelectQueryData, ToSQLOptions } from '../sql';
import {
  AdapterOptions,
  Adapter,
  QueryResult,
  QueryArraysResult,
} from '../adapter';
import {
  getColumnTypes,
  getTableData,
  DefaultColumnTypes,
  makeColumnTypes,
} from '../columns';
import { QueryError, QueryErrorName } from '../errors';
import {
  DbBase,
  DefaultSelectColumns,
  applyMixins,
  pushOrNewArray,
  ColumnShapeOutput,
  SinglePrimaryKey,
  snakeCaseKey,
  toSnakeCase,
  Sql,
  QueryThen,
  QueryCatch,
  ColumnsParsers,
  TransactionState,
  QueryResultRow,
  TemplateLiteralArgs,
  QueryInternal,
  SQLQueryArgs,
  isRawSQL,
  EmptyObject,
  ColumnTypeBase,
  emptyObject,
  CoreQueryScopes,
  ColumnSchemaConfig,
  QueryColumns,
  QueryColumnsInit,
} from 'orchid-core';
import { inspect } from 'node:util';
import { AsyncLocalStorage } from 'node:async_hooks';
import { templateLiteralToSQL } from '../sql/rawSql';
import { RelationsBase } from '../relations';
import { ScopeArgumentQuery } from '../queryMethods/scope';
import { QueryBase } from './queryBase';
import {
  defaultSchemaConfig,
  DefaultSchemaConfig,
} from '../columns/defaultSchemaConfig';
import { enableSoftDelete, SoftDeleteOption } from '../queryMethods/softDelete';

export type NoPrimaryKeyOption = 'error' | 'warning' | 'ignore';

export type DbOptions<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> = (
  | { adapter: Adapter }
  | Omit<AdapterOptions, 'log'>
) &
  QueryLogOptions & {
    schemaConfig?: SchemaConfig;
    // concrete column types or a callback for overriding standard column types
    // this types will be used in tables to define their columns
    columnTypes?:
      | ColumnTypes
      | ((t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes);
    autoPreparedStatements?: boolean;
    noPrimaryKey?: NoPrimaryKeyOption;
    // when set to true, all columns will be translated to `snake_case` when querying database
    snakeCase?: boolean;
    // if `now()` for some reason doesn't suite your timestamps, provide a custom SQL for it
    nowSQL?: string;
  };

// Options of `createDb`.
export type DbTableOptions<
  Table extends string | undefined,
  Shape extends QueryColumns,
> = {
  schema?: string;
  // prepare all SQL queries before executing
  // true by default
  autoPreparedStatements?: boolean;
  noPrimaryKey?: NoPrimaryKeyOption;
  snakeCase?: boolean;
  // default language for the full text search
  language?: string;
  /**
   * See {@link ScopeMethods}
   */
  scopes?: DbTableOptionScopes<Table, Shape>;
  /**
   * See {@link SoftDeleteMethods}
   */
  softDelete?: SoftDeleteOption<Shape>;
} & QueryLogOptions;

/**
 * See {@link ScopeMethods}
 */
export type DbTableOptionScopes<
  Table extends string | undefined,
  Shape extends QueryColumns,
  Keys extends string = string,
> = Record<Keys, (q: ScopeArgumentQuery<Table, Shape>) => QueryBase>;

// Type of data returned from the table query by default, doesn't include computed columns.
// `const user: User[] = await db.user;`
export type QueryDefaultReturnData<Shape extends QueryColumnsInit> = Pick<
  ColumnShapeOutput<Shape>,
  DefaultSelectColumns<Shape>[number]
>[];

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends QueryColumnsInit = Record<string, never>,
  Relations extends RelationsBase = EmptyObject,
  ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
  ShapeWithComputed extends QueryColumnsInit = Shape,
  Scopes extends CoreQueryScopes | undefined = EmptyObject,
  Data = QueryDefaultReturnData<Shape>,
> extends DbBase<Adapter, Table, Shape, ColumnTypes, ShapeWithComputed>,
    QueryMethods<ColumnTypes> {
  new (
    adapter: Adapter,
    queryBuilder: Db<Table, Shape, Relations, ColumnTypes>,
    table?: Table,
    shape?: Shape,
    options?: DbTableOptions<Table, ShapeWithComputed>,
  ): this;
  internal: QueryInternal;
  queryBuilder: Db;
  onQueryBuilder: Query['onQueryBuilder'];
  primaryKeys: Query['primaryKeys'];
  q: QueryData;
  returnType: Query['returnType'];
  then: QueryThen<Data>;
  catch: QueryCatch<Data>;
  windows: Query['windows'];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  relations: Relations;
  withData: Query['withData'];
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError<this>;
  meta: {
    kind: 'select';
    defaults: {
      [K in keyof Shape as unknown extends Shape[K]['data']['default']
        ? never
        : K]: true;
    };
    scopes: Record<keyof Scopes, true>;
    selectable: SelectableFromShape<ShapeWithComputed, Table>;
  };
}

export const anyShape = {} as QueryColumnsInit;

export class Db<
  Table extends string | undefined = undefined,
  Shape extends QueryColumnsInit = Record<string, never>,
  Relations extends RelationsBase = EmptyObject,
  ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
  ShapeWithComputed extends QueryColumnsInit = Shape,
> implements Query
{
  constructor(
    public adapter: Adapter,
    public queryBuilder: Db,
    public table: Table = undefined as Table,
    public shape: ShapeWithComputed = anyShape as ShapeWithComputed,
    public columnTypes: ColumnTypes,
    transactionStorage: AsyncLocalStorage<TransactionState>,
    options: DbTableOptions<Table, ShapeWithComputed>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const { softDelete } = options;
    const scopes = (
      options.scopes || softDelete ? {} : emptyObject
    ) as QueryScopes;

    const tableData = getTableData();
    this.internal = {
      ...tableData,
      transactionStorage,
      scopes,
    };

    this.baseQuery = this as Query;

    const logger = options.logger || console;

    const parsers = {} as ColumnsParsers;
    let hasParsers = false;
    let modifyQuery: ((q: Query) => void)[] | undefined = undefined;
    let hasCustomName = false;
    const { snakeCase } = options;
    for (const key in shape) {
      const column = shape[key] as unknown as ColumnTypeBase;
      if (column.parseFn) {
        hasParsers = true;
        parsers[key] = column.parseFn;
      }

      if (column.data.modifyQuery) {
        modifyQuery = pushOrNewArray(modifyQuery, column.data.modifyQuery);
      }

      if (column.data.name) {
        hasCustomName = true;
      } else if (snakeCase) {
        const snakeName = toSnakeCase(key);
        if (snakeName !== key) {
          hasCustomName = true;
          column.data.name = snakeName;
        }
      }

      if (typeof column.data.default === 'function') {
        const arr = this.internal.runtimeDefaultColumns;
        if (!arr) this.internal.runtimeDefaultColumns = [key];
        else arr.push(key);

        if (!column.data.runtimeDefault) {
          const {
            data: { default: def },
            encodeFn,
          } = column;

          column.data.runtimeDefault = encodeFn
            ? () => encodeFn(def())
            : (def as () => unknown);
        }
      }
    }

    if (hasCustomName) {
      const list: string[] = [];
      for (const key in shape) {
        const column = shape[key] as unknown as ColumnTypeBase;
        list.push(
          column.data.name ? `"${column.data.name}" AS "${key}"` : `"${key}"`,
        );
      }
      this.internal.columnsForSelectAll = list;
    }

    this.q = {
      adapter,
      shape: shape as QueryColumnsInit,
      handleResult,
      logger,
      log: logParamToLogObject(logger, options.log),
      autoPreparedStatements: options.autoPreparedStatements ?? false,
      parsers: hasParsers ? parsers : undefined,
      language: options.language,
    } as QueryData;

    if (options?.schema) {
      this.q.schema = options.schema;
    }

    this.primaryKeys = Object.keys(shape).filter(
      (key) => shape[key].data.isPrimaryKey,
    );
    const primaryKeysFromData = getTableData().primaryKey?.columns;
    if (primaryKeysFromData) this.primaryKeys.push(...primaryKeysFromData);

    if (this.primaryKeys.length === 1) {
      this.singlePrimaryKey = this
        .primaryKeys[0] as unknown as SinglePrimaryKey<Shape>;
    } else if (
      this.primaryKeys.length === 0 &&
      shape !== anyShape &&
      options.noPrimaryKey !== 'ignore'
    ) {
      const message = `Table ${table} has no primary key`;
      if (options.noPrimaryKey === 'error') throw new Error(message);
      else logger.warn(message);
    }

    const columns = Object.keys(
      shape,
    ) as unknown as (keyof ColumnShapeOutput<Shape>)[];
    const { toSQL } = this;

    this.columns = columns as (keyof ColumnShapeOutput<Shape>)[];
    this.defaultSelectColumns = columns.filter(
      (column) => !shape[column as keyof typeof shape].data.isHidden,
    ) as DefaultSelectColumns<Shape>;

    const defaultSelect =
      this.defaultSelectColumns.length === columns.length
        ? undefined
        : this.defaultSelectColumns;

    this.toSQL = defaultSelect
      ? function <T extends Query>(this: T, options?: ToSQLOptions): Sql {
          const q = this.clone();
          if (!(q.q as SelectQueryData).select) {
            (q.q as SelectQueryData).select = defaultSelect as string[];
          }
          return toSQL.call(q, options);
        }
      : toSQL;

    this.relations = {} as Relations;

    modifyQuery?.forEach((cb) => cb(this));

    this.error = class extends QueryError {
      constructor(message?: string) {
        super(self, message);
      }
    };

    if (options.scopes) {
      for (const key in options.scopes) {
        const q = options.scopes[key](this).q as SelectQueryData;

        const s: Partial<SelectQueryData> = {};
        if (q.and) s.and = q.and;
        if (q.or) s.or = q.or;

        (scopes as Record<string, unknown>)[key] = s;
      }

      if (scopes.default) {
        Object.assign(this.q, scopes.default);
        this.q.scopes = { default: scopes.default };
      }
    }

    if (softDelete) {
      enableSoftDelete(this, table, shape, softDelete, scopes);
    }
  }

  [inspect.custom]() {
    return `QueryObject<${this.table}>`;
  }

  /**
   * Use `query` to perform raw SQL queries.
   *
   * ```ts
   * const value = 1;
   *
   * // it is safe to interpolate inside the backticks (``):
   * const result = await db.query<{ one: number }>`SELECT ${value} AS one`;
   * // data is inside `rows` array:
   * result.rows[0].one;
   * ```
   *
   * If the query is executing inside a transaction, it will use the transaction connection automatically.
   *
   * ```ts
   * await db.transaction(async () => {
   *   // both queries will execute in the same transaction
   *   await db.query`SELECT 1`;
   *   await db.query`SELECT 2`;
   * });
   * ```
   *
   * Alternatively, support a simple SQL string, with optional `values`:
   *
   * Note that the values is a simple array, and the SQL is referring to the values with `$1`, `$2` and so on.
   *
   * ```ts
   * const value = 1;
   *
   * // it is NOT safe to interpolate inside a simple string, use `values` to pass the values.
   * const result = await db.query<{ one: number }>({
   *   raw: 'SELECT $1 AS one',
   *   values: [value],
   * });
   * // data is inside `rows` array:
   * result.rows[0].one;
   * ```
   *
   * @param args - SQL template literal, or an object { raw: string, values?: unknown[] }
   */
  query<T extends QueryResultRow = QueryResultRow>(
    ...args: SQLQueryArgs
  ): Promise<QueryResult<T>> {
    return performQuery<QueryResult<T>>(this, args, 'query');
  }

  /**
   * The same as the {@link query}, but returns an array of arrays instead of objects:
   *
   * ```ts
   * const value = 1;
   *
   * // it is safe to interpolate inside the backticks (``):
   * const result = await db.queryArrays<[number]>`SELECT ${value} AS one`;
   * // `rows` is an array of arrays:
   * const row = result.rows[0];
   * row[0]; // our value
   * ```
   *
   * @param args - SQL template literal, or an object { raw: string, values?: unknown[] }
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryArrays<R extends any[] = any[]>(
    ...args: SQLQueryArgs
  ): Promise<QueryArraysResult<R>> {
    return performQuery<QueryArraysResult<R>>(this, args, 'arrays');
  }
}

const performQuery = async <Result>(
  q: {
    queryBuilder: Db;
    internal: QueryInternal;
    adapter: Adapter;
    q: QueryData;
  },
  args: SQLQueryArgs,
  method: 'query' | 'arrays',
): Promise<Result> => {
  const trx = q.internal.transactionStorage.getStore();
  let sql: Sql;
  if (isRawSQL(args[0])) {
    const values: unknown[] = [];
    sql = {
      text: args[0].toSQL({ values }),
      values,
    };
  } else {
    const values: unknown[] = [];
    sql = {
      text: templateLiteralToSQL(args as TemplateLiteralArgs, {
        queryBuilder: q.queryBuilder,
        sql: [],
        values,
      }),
      values,
    };
  }

  const { log } = q.q;
  let logData: unknown | undefined;
  if (log) logData = log.beforeQuery(sql);

  try {
    const result = (await (trx?.adapter || q.adapter)[method as 'query'](
      sql,
    )) as Promise<Result>;

    if (log) log.afterQuery(sql, logData);

    return result;
  } catch (err) {
    if (log) {
      log.onError(err as Error, sql, logData);
    }

    throw err;
  }
};

applyMixins(Db, [QueryMethods]);
Db.prototype.constructor = Db;
Db.prototype.onQueryBuilder = OnQueryBuilder;

// Function to build a new table instance.
export type DbTableConstructor<ColumnTypes> = <
  Table extends string,
  Shape extends QueryColumnsInit,
  Options extends DbTableOptions<Table, Shape>,
>(
  table: Table,
  shape?: ((t: ColumnTypes) => Shape) | Shape,
  options?: Options,
) => Db<
  Table,
  Shape,
  EmptyObject,
  ColumnTypes,
  Shape,
  MapTableScopesOption<Options['scopes'], Options['softDelete']>
>;

export type MapTableScopesOption<
  Scopes extends CoreQueryScopes | undefined,
  SoftDelete extends true | PropertyKey | undefined,
> = {
  [K in
    | keyof Scopes
    | (SoftDelete extends true | PropertyKey ? 'nonDeleted' : never)]: unknown;
};

export type DbResult<ColumnTypes> = Db<
  string,
  Record<string, never>,
  EmptyObject,
  ColumnTypes
> &
  DbTableConstructor<ColumnTypes> & {
    adapter: Adapter;
    close: Adapter['close'];
  };

/**
 * For the case of using the query builder as a standalone tool, use `createDb` from `pqb` package.
 *
 * As `Orchid ORM` focuses on ORM usage, docs examples mostly demonstrates how to work with ORM-defined tables,
 * but everything that's not related to table relations should also work with `pqb` query builder on its own.
 *
 * It is accepting the same options as `orchidORM` + options of `createBaseTable`:
 *
 * ```ts
 * import { createDb } from 'orchid-orm';
 *
 * const db = createDb({
 *   // db connection options
 *   databaseURL: process.env.DATABASE_URL,
 *   log: true,
 *
 *   // columns in db are in snake case:
 *   snakeCase: true,
 *
 *   // override default SQL for timestamp, see `nowSQL` above
 *   nowSQL: `now() AT TIME ZONE 'UTC'`,
 *
 *   // override column types:
 *   columnTypes: (t) => ({
 *     // by default timestamp is returned as a string, override to a number
 *     timestamp: () => t.timestamp().asNumber(),
 *   }),
 * });
 * ```
 *
 * After `db` is defined, construct queryable tables in such way:
 *
 * ```ts
 * export const User = db('user', (t) => ({
 *   id: t.identity().primaryKey(),
 *   name: t.text(3, 100),
 *   password: t.text(8, 200),
 *   age: t.integer().nullable(),
 *   ...t.timestamps(),
 * }));
 * ```
 *
 * Now the `User` can be used for making type-safe queries:
 *
 * ```ts
 * const users = await User.select('id', 'name') // only known columns are allowed
 *   .where({ age: { gte: 20 } }) // gte is available only on the numeric field, and the only number is allowed
 *   .order({ createdAt: 'DESC' }) // type safe as well
 *   .limit(10);
 *
 * // users array has a proper type of Array<{ id: number, name: string }>
 * ```
 *
 * The optional third argument is for table options:
 *
 * ```ts
 * const Table = db('table', (t) => ({ ...columns }), {
 *   // provide this value if the table belongs to a specific database schema:
 *   schema: 'customTableSchema',
 *   // override `log` option of `createDb`:
 *   log: true, // boolean or object described `createdDb` section
 *   logger: { ... }, // override logger
 *   noPrimaryKey: 'ignore', // override noPrimaryKey
 *   snakeCase: true, // override snakeCase
 * })
 * ```
 */
export const createDb = <
  SchemaConfig extends ColumnSchemaConfig = DefaultSchemaConfig,
  ColumnTypes = DefaultColumnTypes<SchemaConfig>,
>({
  log,
  logger,
  snakeCase,
  nowSQL,
  schemaConfig = defaultSchemaConfig as unknown as SchemaConfig,
  columnTypes: ctOrFn = makeColumnTypes(schemaConfig) as unknown as ColumnTypes,
  ...options
}: DbOptions<SchemaConfig, ColumnTypes>): DbResult<ColumnTypes> => {
  const adapter = 'adapter' in options ? options.adapter : new Adapter(options);
  const commonOptions = {
    log,
    logger,
    autoPreparedStatements: options.autoPreparedStatements ?? false,
    noPrimaryKey: options.noPrimaryKey ?? 'error',
    snakeCase,
  };

  const ct =
    typeof ctOrFn === 'function'
      ? (
          ctOrFn as unknown as (
            t: DefaultColumnTypes<SchemaConfig>,
          ) => ColumnTypes
        )(makeColumnTypes(schemaConfig))
      : ctOrFn;

  if (snakeCase) {
    (ct as { [snakeCaseKey]?: boolean })[snakeCaseKey] = true;
  }

  const transactionStorage = new AsyncLocalStorage<TransactionState>();

  const qb = new Db(
    adapter,
    undefined as unknown as Db,
    undefined,
    anyShape,
    ct,
    transactionStorage,
    commonOptions,
  );
  qb.queryBuilder = qb as unknown as Db;

  const tableConstructor: DbTableConstructor<ColumnTypes> = (
    table,
    shape,
    options,
  ) =>
    new Db(
      adapter,
      qb as unknown as Db,
      table,
      typeof shape === 'function'
        ? getColumnTypes(ct, shape, nowSQL, options?.language)
        : shape,
      ct,
      transactionStorage,
      { ...commonOptions, ...options },
    ) as never;

  const db = Object.assign(tableConstructor, qb, {
    adapter,
    close: () => adapter.close(),
  });

  // Set all methods from prototype to the db instance (needed for transaction at least):
  for (const name of Object.getOwnPropertyNames(Db.prototype)) {
    (db as unknown as Record<string, unknown>)[name] =
      Db.prototype[name as keyof typeof Db.prototype];
  }

  return db as unknown as DbResult<ColumnTypes>;
};
