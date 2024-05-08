import {
  DbDomainArg,
  DbExtension,
  Query,
  QueryInternal,
  SelectableFromShape,
} from './query';
import {
  handleResult,
  logParamToLogObject,
  QueryLogOptions,
  QueryMethods,
} from '../queryMethods';
import { QueryData, QueryScopes, SelectQueryData, ToSQLOptions } from '../sql';
import {
  Adapter,
  AdapterOptions,
  QueryArraysResult,
  QueryResult,
} from '../adapter';
import {
  DefaultColumnTypes,
  getColumnTypes,
  makeColumnTypes,
} from '../columns';
import { QueryError, QueryErrorName } from '../errors';
import {
  applyMixins,
  ColumnSchemaConfig,
  ColumnShapeOutput,
  ColumnsParsers,
  ColumnTypeBase,
  CoreQueryScopes,
  DbBase,
  DefaultSelectColumns,
  EmptyObject,
  emptyObject,
  isRawSQL,
  MaybeArray,
  pushOrNewArray,
  QueryCatch,
  QueryColumns,
  QueryColumnsInit,
  QueryResultRow,
  QueryThen,
  RecordString,
  RecordUnknown,
  snakeCaseKey,
  Sql,
  SQLQueryArgs,
  TemplateLiteralArgs,
  toSnakeCase,
  TransactionState,
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
import {
  parseTableData,
  TableData,
  TableDataFn,
  TableDataItem,
  TableDataItemsUniqueColumnTuples,
  TableDataItemsUniqueColumns,
  TableDataItemsUniqueConstraints,
  UniqueQueryTypeOrExpression,
} from '../tableData';

export type ShapeColumnPrimaryKeys<Shape extends QueryColumnsInit> = {
  [K in {
    [K in keyof Shape]: Shape[K]['data']['primaryKey'] extends string
      ? K
      : never;
  }[keyof Shape]]: UniqueQueryTypeOrExpression<Shape[K]['queryType']>;
};

export type ShapeUniqueColumns<Shape extends QueryColumnsInit> = {
  [K in keyof Shape]: Shape[K]['data']['unique'] extends string
    ? {
        [C in K]: UniqueQueryTypeOrExpression<Shape[K]['queryType']>;
      }
    : never;
}[keyof Shape];

export type UniqueConstraints<Shape extends QueryColumnsInit> =
  | {
      [K in keyof Shape]: Shape[K]['data']['primaryKey'] extends string
        ? string extends Shape[K]['data']['primaryKey']
          ? never
          : Shape[K]['data']['primaryKey']
        : Shape[K]['data']['unique'] extends string
        ? string extends Shape[K]['data']['unique']
          ? never
          : Shape[K]['data']['unique']
        : never;
    }[keyof Shape];

export type NoPrimaryKeyOption = 'error' | 'warning' | 'ignore';

// Options that are also available in `orchidORM` of the ORM
export interface DbSharedOptions extends QueryLogOptions {
  autoPreparedStatements?: boolean;
  noPrimaryKey?: NoPrimaryKeyOption;
  extensions?: (string | RecordString)[];
  domains?: {
    [K: string]: DbDomainArg<DefaultColumnTypes<DefaultSchemaConfig>>;
  };
}

export type DbOptions<SchemaConfig extends ColumnSchemaConfig, ColumnTypes> = (
  | { adapter: Adapter }
  | Omit<AdapterOptions, 'log'>
) &
  DbSharedOptions & {
    schemaConfig?: SchemaConfig;
    // concrete column types or a callback for overriding standard column types
    // this types will be used in tables to define their columns
    columnTypes?:
      | ColumnTypes
      | ((t: DefaultColumnTypes<SchemaConfig>) => ColumnTypes);
    // when set to true, all columns will be translated to `snake_case` when querying database
    snakeCase?: boolean;
    // if `now()` for some reason doesn't suite your timestamps, provide a custom SQL for it
    nowSQL?: string;
  };

// Options of `createDb`.
export interface DbTableOptions<
  Table extends string | undefined,
  Shape extends QueryColumns,
> extends QueryLogOptions {
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
  // table comment, for migrations generator
  comment?: string;
}

/**
 * See {@link ScopeMethods}
 */
export type DbTableOptionScopes<
  Table extends string | undefined,
  Shape extends QueryColumns,
  Keys extends string = string,
> = { [K in Keys]: (q: ScopeArgumentQuery<Table, Shape>) => QueryBase };

// Type of data returned from the table query by default, doesn't include computed columns.
// `const user: User[] = await db.user;`
export type QueryDefaultReturnData<Shape extends QueryColumnsInit> = {
  [K in DefaultSelectColumns<Shape>[number]]: Shape[K]['outputType'];
}[];

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends QueryColumnsInit = QueryColumnsInit,
  PrimaryKeys = never,
  // union of records { column name: query input type }
  UniqueColumns = never,
  // union of tuples of column names
  UniqueColumnTuples = never,
  // union of primary keys and unique index names
  UniqueConstraints = never,
  Relations extends RelationsBase = EmptyObject,
  ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
  ShapeWithComputed extends QueryColumnsInit = Shape,
  Scopes extends CoreQueryScopes | undefined = EmptyObject,
> extends DbBase<Adapter, Table, Shape, ColumnTypes, ShapeWithComputed>,
    QueryMethods<ColumnTypes>,
    QueryBase {
  result: Pick<Shape, DefaultSelectColumns<Shape>[number]>; // Pick is optimal
  queryBuilder: Db;
  returnType: Query['returnType'];
  then: QueryThen<QueryDefaultReturnData<Shape>>;
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
    scopes: { [K in keyof Scopes]: true };
    selectable: SelectableFromShape<ShapeWithComputed, Table>;
  };
  internal: QueryInternal<
    {
      [K in keyof PrimaryKeys]: (
        keyof PrimaryKeys extends K ? never : keyof PrimaryKeys
      ) extends never
        ? PrimaryKeys[K]
        : never;
    }[keyof PrimaryKeys],
    PrimaryKeys | UniqueColumns,
    | {
        [K in keyof Shape]: Shape[K]['data']['unique'] extends string
          ? K
          : never;
      }[keyof Shape]
    | keyof PrimaryKeys,
    UniqueColumnTuples,
    UniqueConstraints
  >;
  catch: QueryCatch;
}

export const anyShape = {} as QueryColumnsInit;

export class Db<
  Table extends string | undefined = undefined,
  Shape extends QueryColumnsInit = QueryColumnsInit,
  PrimaryKeys = never,
  UniqueColumns = never,
  UniqueColumnTuples = never,
  UniqueConstraints = never,
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
    tableData: TableData = emptyObject,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const { softDelete } = options;
    const scopes = (
      options.scopes || softDelete ? {} : emptyObject
    ) as QueryScopes;

    this.internal = {
      transactionStorage,
      scopes,
      snakeCase: options.snakeCase,
      noPrimaryKey: options.noPrimaryKey === 'ignore',
      comment: options.comment,
      tableData,
    } as QueryInternal;

    this.baseQuery = this as Query;

    const logger = options.logger || console;

    const parsers = {} as ColumnsParsers;
    let hasParsers = false;
    let modifyQuery: ((q: Query) => void)[] | undefined = undefined;
    let hasCustomName = false;
    const { snakeCase } = options;
    for (const key in shape) {
      const column = shape[key] as unknown as ColumnTypeBase;
      column.data.key = key;

      if (column.parseFn) {
        hasParsers = true;
        parsers[key] = column.parseFn;
      }

      const { modifyQuery: mq } = column.data;
      if (mq) {
        modifyQuery = pushOrNewArray(modifyQuery, (q: Query) => mq(q, column));
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
      schema: options?.schema,
    } as QueryData;

    let shapeHasPrimaryKey: boolean | undefined;
    for (const key in shape) {
      if (shape[key].data.primaryKey) {
        shapeHasPrimaryKey = true;

        if (this.internal.singlePrimaryKey) {
          this.internal.singlePrimaryKey = undefined as never;
          break;
        }

        this.internal.singlePrimaryKey = key as never;
      }
    }

    if (
      !shapeHasPrimaryKey &&
      !tableData.primaryKey &&
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

    if (modifyQuery) {
      for (const cb of modifyQuery) {
        cb(this);
      }
    }

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

        (scopes as RecordUnknown)[key] = s;
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
    return `Query<${this.table}>`;
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

// Function to build a new table instance.
export type DbTableConstructor<ColumnTypes> = <
  Table extends string,
  Shape extends QueryColumnsInit,
  Data extends MaybeArray<TableDataItem>,
  Options extends DbTableOptions<Table, Shape>,
>(
  table: Table,
  shape?: ((t: ColumnTypes) => Shape) | Shape,
  tableData?: TableDataFn<Shape, Data>,
  options?: Options,
) => Db<
  Table,
  Shape,
  keyof ShapeColumnPrimaryKeys<Shape> extends never
    ? never
    : ShapeColumnPrimaryKeys<Shape>,
  ShapeUniqueColumns<Shape> | TableDataItemsUniqueColumns<Shape, Data>,
  TableDataItemsUniqueColumnTuples<Shape, Data>,
  UniqueConstraints<Shape> | TableDataItemsUniqueConstraints<Data>,
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

export interface DbResult<ColumnTypes>
  extends Db<
      string,
      never,
      never,
      never,
      never,
      never,
      EmptyObject,
      ColumnTypes
    >,
    DbTableConstructor<ColumnTypes> {
  adapter: Adapter;
  close: Adapter['close'];
}
{
}

/**
 * If you'd like to use the query builder of OrchidORM as a standalone tool, install `pqb` package and use `createDb` to initialize it.
 *
 * As `Orchid ORM` focuses on ORM usage, docs examples mostly demonstrates how to work with ORM-defined tables,
 * but everything that's not related to table relations should also work with `pqb` query builder on its own.
 *
 * It is accepting the same options as `orchidORM` + options of `createBaseTable`:
 *
 * ```ts
 * import { createDb } from 'orchid-orm';
 *
 * import { zodSchemaConfig } from 'orchid-orm-schema-to-zod';
 * // or
 * import { SchemaConfig } from 'orchid-orm-valibot';
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
 *   // optional, but recommended: makes zod schemas for your tables
 *   schemaConfig: zodSchemaConfig,
 *   // or
 *   schemaConfig: valibotSchemaConfig,
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

  const qb = _initQueryBuilder(
    adapter,
    ct,
    transactionStorage,
    commonOptions,
    options,
  );

  const tableConstructor: DbTableConstructor<ColumnTypes> = (
    table,
    shape,
    dataFn,
    options,
  ) =>
    new Db(
      adapter,
      qb as never,
      table,
      typeof shape === 'function'
        ? getColumnTypes(ct, shape, nowSQL, options?.language)
        : shape,
      ct,
      transactionStorage,
      { ...commonOptions, ...options },
      parseTableData(dataFn),
    ) as never;

  const db = Object.assign(tableConstructor, qb, {
    adapter,
    close: () => adapter.close(),
  });

  // Set all methods from prototype to the db instance (needed for transaction at least):
  for (const name of Object.getOwnPropertyNames(Db.prototype)) {
    (db as unknown as RecordUnknown)[name] =
      Db.prototype[name as keyof typeof Db.prototype];
  }

  return db as never;
};

export const _initQueryBuilder = (
  adapter: Adapter,
  columnTypes: unknown,
  transactionStorage: AsyncLocalStorage<TransactionState>,
  commonOptions: DbTableOptions<undefined, QueryColumns>,
  options: DbSharedOptions,
): Db => {
  const qb = new Db(
    adapter,
    undefined as unknown as Db,
    undefined,
    anyShape,
    columnTypes,
    transactionStorage,
    commonOptions,
  );

  if (options.extensions) {
    const arr: DbExtension[] = [];
    for (const x of options.extensions) {
      if (typeof x === 'string') {
        arr.push({ name: x });
      } else {
        for (const key in x) {
          arr.push({ name: key, version: x[key] });
        }
      }
    }
    qb.internal.extensions = arr;
  }

  qb.internal.domains = options.domains;

  return (qb.queryBuilder = qb as never);
};
