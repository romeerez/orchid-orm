import {
  Column,
  FromArg,
  FromResult,
  QueryLogOptions,
  StorageOptions,
  Adapter,
  AsyncState,
  defaultSchemaConfig,
  DbSharedOptions,
  DbTableOptionScopes,
  DbTableOptions,
  _initQueryBuilder,
  makeColumnTypes,
  MaybeArray,
  MergeQuery,
  NoPrimaryKeyOption,
  QueryData,
  ColumnSchemaConfig,
  TableRlsConfig,
} from 'pqb/internal';
import {
  ORMTableInput,
  TableClasses,
  BaseTableClass,
  TableToDb,
} from './base-table';
import { applyRelations } from './relations/relations';
import {
  transaction,
  ensureTransaction,
  isInTransaction,
  afterCommit,
} from './transaction';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Db, Query } from 'pqb';

export interface FromQuery extends Query {
  returnType: 'all';
}

interface OrchidORMQueryHelper<
  Q extends Query,
  Args extends unknown[],
  Result,
> {
  <T extends Query>(
    q: T & { table: Q['table'] },
    ...args: Args
  ): Result extends Query ? MergeQuery<T, Result> : Result;
  isQueryHelper: true;
  table: Q['table'];
  args: Args;
  result: Result;
}

export interface OrchidORMTableHelper<T extends Query> {
  makeHelper<Args extends unknown[], Result>(
    fn: (q: T, ...args: Args) => Result,
  ): OrchidORMQueryHelper<T, Args, Result>;
}

export type OrchidORMTables<T extends TableClasses = TableClasses> = {
  [K in keyof T]: T[K] extends { new (): infer R extends ORMTableInput }
    ? OrchidORMTableHelper<TableToDb<R>>
    : never;
};

export type OrchidORMDbTables<T extends TableClasses = TableClasses> = {
  [K in keyof T]: T[K] extends { new (): infer R extends ORMTableInput }
    ? TableToDb<R>
    : never;
};

export type OrchidORM<T extends TableClasses = TableClasses> =
  OrchidORMDbTables<T> & OrchidORMMethods;

/**
 * Identity helper for table row-level security configuration.
 */
export const defineRls = <T extends TableRlsConfig>(rls: T): T => rls;

interface OrchidORMMethods {
  /**
   * @see import('pqb').QueryTransaction.prototype.transaction
   */
  $transaction: typeof transaction;
  /**
   * @see import('pqb').QueryTransaction.prototype.ensureTransaction
   */
  $ensureTransaction: typeof ensureTransaction;
  /**
   * @see import('pqb').QueryTransaction.prototype.isInTransaction
   */
  $isInTransaction: typeof isInTransaction;
  /**
   * @see import('pqb').QueryTransaction.prototype.afterCommit
   */
  $afterCommit: typeof afterCommit;
  $qb: Db;
  $adapterNotInTransaction: Adapter;

  /**
   * Adapter is a wrapper on top of `postgres-js`, `node-postgres`, or other db driver.
   *
   * When in transaction, returns a db adapter object for the transaction,
   * returns a default adapter object otherwise.
   *
   * Treat the adapter as implementation detail and avoid accessing it directly.
   */
  $getAdapter(): Adapter;

  /**
   * Use `$query` to perform raw SQL queries.
   *
   * ```ts
   * const value = 1;
   *
   * // it is safe to interpolate inside the backticks (``):
   * const result = await db.$query<{ one: number }>`SELECT ${value}  one`;
   * // data is inside `rows` array:
   * result.rows[0].one;
   * ```
   *
   * If the query is executing inside a transaction, it will use the transaction connection automatically.
   *
   * ```ts
   * await db.transaction(async () => {
   *   // both queries will execute in the same transaction
   *   await db.$query`SELECT 1`;
   *   await db.$query`SELECT 2`;
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
   * const result = await db.$query<{ one: number }>({
   *   raw: 'SELECT $1 AS one',
   *   values: [value],
   * });
   * // data is inside `rows` array:
   * result.rows[0].one;
   * ```
   *
   * @param args - SQL template literal, or an object { raw: string, values?: unknown[] }
   */
  $query: Db['query'];

  /**
   * The same as the {@link $query}, but returns an array of arrays instead of objects:
   *
   * ```ts
   * const value = 1;
   *
   * // it is safe to interpolate inside the backticks (``):
   * const result = await db.$queryArrays<[number]>`SELECT ${value} AS one`;
   * // `rows` is an array of arrays:
   * const row = result.rows[0];
   * row[0]; // our value
   * ```
   *
   * @param args - SQL template literal, or an object { raw: string, values?: unknown[] }
   */
  $queryArrays: Db['queryArrays'];

  /**
   * See {@link FromMethods.from}
   */
  $from<Arg extends MaybeArray<FromArg<Query>>>(
    arg: Arg,
  ): FromResult<FromQuery, Arg>;

  /**
   * `$withOptions` supports overriding `log`, `schema`, `role`, and `setConfig`.
   *
   * - `log`: boolean, enables or disables logging in the scope of the callback.
   * - `schema`: set a **default** schema, note that it does not override
   *   if you already have a schema set in the ORM config or for a specific table.
   * - `role`: string, switches the Postgres role for the duration of the callback.
   *   Used for row-level security policies.
   * - `setConfig`: object with string, number, or boolean values, sets Postgres custom
   *   settings for the duration of the callback. Use dotted names like `app.tenant_id`.
   *   Values are normalized to strings internally.
   *
   * SQL session options (`role` and `setConfig`) cannot be nested.
   * If an outer scope already has `role` or `setConfig`, attempting to set them again
   * in a nested `$withOptions` call will throw an error.
   * For transaction-bound work that needs nested overrides, pass `role` and
   * `setConfig` to nested `$transaction` calls instead.
   * Nested scopes that only change `log` or `schema` will inherit the outer SQL session context.
   *
   * Explicit transactions inside the callback inherit the same SQL session context:
   *
   * ```ts
   * await db.$withOptions(
   *   {
   *     role: 'app_user',
   *     setConfig: {
   *       'app.tenant_id': tenantId,
   *       'app.user_id': userId,
   *     },
   *   },
   *   async () => {
   *     const project = await db.project.find(projectId);
   *
   *     await db.$transaction(async () => {
   *       // This query runs in the transaction with the same role and config
   *       await db.project.find(projectId).update({ lastViewedAt: new Date() });
   *     });
   *   },
   * );
   * ```
   *
   * When the request's DB work should run in one transaction, prefer passing
   * `role` and `setConfig` directly to `$transaction`.
   *
   * Basic usage with `log` and `schema`:
   *
   * ```ts
   * await db.$withOptions({ log: true, schema: 'custom' }, async () => {
   *   // will log this query, and will use the custom schema for this table,
   *   // unless this table already has a configured schema.
   *   await db.table.find(123);
   * });
   * ```
   */
  $withOptions<Result>(
    options: StorageOptions,
    cb: () => Promise<Result>,
  ): Promise<Result>;

  $close(): Promise<void>;
}

export type OrchidOrmParam<Options> = true | null extends true
  ? 'Set strict: true to tsconfig'
  : Options;

interface OrchidORMBundleMetadata {
  // Original table classes for later DB binding.
  tables: TableClasses;
  // Set db-aware instance so that the minimal preliminary query objects can access it.
  setDbAwareInstance(orm: OrchidORMDbTables): void;
}

const orchidORMBundleMetadataKey = Symbol('orchidORMBundleMetadataKey');

type CommonOrmOptions = QueryLogOptions & {
  autoPreparedStatements?: boolean;
  noPrimaryKey?: NoPrimaryKeyOption;
};

const assignTablesToOrm = <T extends TableClasses>(
  tables: T,
  result: OrchidORMDbTables<T>,
  adapter: Adapter,
  qb: Db,
  asyncStorage: AsyncLocalStorage<AsyncState>,
  commonOptions: CommonOrmOptions,
  schema: DbSharedOptions['schema'],
) => {
  const tableInstances: Record<string, ORMTableInput> = {};

  for (const key in tables) {
    if (key[0] === '$') {
      throw new Error(`Table class name must not start with $`);
    }

    const tableClass = tables[key];
    const tableImmutable = (
      tableClass as unknown as { instance(): ORMTableInput }
    ).instance();
    const table = Object.create(tableImmutable);
    table.q = { ...table.q };
    table.columns = {
      shape: { ...table.columns.shape },
      data: { ...table.columns.data },
    };
    tableInstances[key] = table;

    const options: DbTableOptions<unknown, string, Column.Shape.QueryInit> = {
      ...commonOptions,
      schema: table.schema || schema,
      language: table.language,
      scopes: table.scopes as DbTableOptionScopes<
        string,
        Column.Shape.QueryInit
      >,
      softDelete: table.softDelete,
      snakeCase: (table as { snakeCase?: boolean }).snakeCase,
      comment: table.comment,
      noPrimaryKey: table.noPrimaryKey ? 'ignore' : undefined,
      computed: table.computed as never,
      nowSQL: (
        tableClass as unknown as BaseTableClass<ColumnSchemaConfig, unknown>
      ).nowSQL,
    };

    const dbTable = new Db(
      adapter,
      qb,
      table.table,
      table.columns.shape,
      table.types,
      asyncStorage,
      options,
      table.columns?.data ?? {},
    );

    (dbTable as unknown as { definedAs: string }).definedAs = key;
    (dbTable as unknown as { db: unknown }).db = result;
    (dbTable as unknown as { filePath: string }).filePath = table.filePath;
    (dbTable as unknown as { name: string }).name = table.constructor.name;
    dbTable.internal.tableRls = table.rls;

    result[key] = dbTable as OrchidORMDbTables<T>[Extract<keyof T, string>];
  }

  applyRelations(qb, tableInstances, result, schema);

  return tableInstances;
};

export const bundleOrchidORMTables = <T extends TableClasses>(
  tables: T,
): OrchidORMTables<T> => {
  const result = {} as OrchidORMTables<T>;

  let dbAwareInstance: OrchidORMDbTables;

  for (const key in tables) {
    result[key] = {
      makeHelper(arg: unknown) {
        // oxlint-disable-next-line typescript/no-explicit-any
        let fn: (...args: any[]) => unknown;
        return (...args: unknown[]) => {
          if (!fn) {
            fn = dbAwareInstance[key].makeHelper(arg as never);
          }
          return fn(...args);
        };
      },
    } as never;
  }

  const meta: OrchidORMBundleMetadata = {
    tables,
    setDbAwareInstance(orm) {
      dbAwareInstance = orm;
    },
  };

  Object.defineProperty(result, orchidORMBundleMetadataKey, {
    enumerable: false,
    value: meta,
  });

  return result;
};

const getOrchidORMBundleMetadata = <T extends TableClasses>(
  orm: OrchidORMTables<T>,
): OrchidORMBundleMetadata => {
  const meta = (
    orm as {
      [orchidORMBundleMetadataKey]?: OrchidORMBundleMetadata;
    }
  )[orchidORMBundleMetadataKey];

  if (!meta) {
    throw new Error(
      'Failed to bind Orchid ORM tables: pass a table bundle created by bundleOrchidORMTables.',
    );
  }

  return meta;
};

export const makeOrchidOrmDbWithAdapter = <T extends TableClasses>(
  orm: OrchidORMTables<T>,
  options: OrchidOrmParam<
    ({ db: Query } | { adapter: Adapter }) & DbSharedOptions
  >,
): OrchidORM<T> => {
  const meta = getOrchidORMBundleMetadata(orm);
  return privateOrchidORMWithAdapter<T>(
    options,
    meta.tables as T,
    meta.setDbAwareInstance,
  );
};

const privateOrchidORMWithAdapter = <T extends TableClasses>(
  {
    log,
    logger,
    autoPreparedStatements,
    noPrimaryKey = 'error',
    schema,
    ...options
  }: OrchidOrmParam<({ db: Query } | { adapter: Adapter }) & DbSharedOptions>,
  tables: T,
  setDbAwareInstance?: OrchidORMBundleMetadata['setDbAwareInstance'],
): OrchidORM<T> => {
  const commonOptions: CommonOrmOptions = {
    log,
    logger,
    autoPreparedStatements,
    noPrimaryKey,
  };

  let adapter: Adapter;
  let asyncStorage;
  let qb: Db;
  if ('db' in options) {
    adapter = options.db.q.adapter;
    asyncStorage = options.db.internal.asyncStorage;
    qb = options.db.qb as Db;
  } else {
    adapter = options.adapter;

    asyncStorage = new AsyncLocalStorage<AsyncState>();

    qb = _initQueryBuilder(
      adapter,
      makeColumnTypes(defaultSchemaConfig),
      asyncStorage,
      commonOptions,
      options,
    );
  }

  qb.internal.rls = options.rls;

  const result = {
    $transaction: transaction,
    $ensureTransaction: ensureTransaction,
    $isInTransaction: isInTransaction,
    $afterCommit: afterCommit,
    $adapterNotInTransaction: adapter,
    $getAdapter,
    $qb: qb,
    get $query() {
      return qb.query;
    },
    $queryArrays: ((...args) =>
      qb.queryArrays(...args)) as typeof qb.queryArrays,
    $with: qb.with.bind(qb),
    $withRecursive: qb.withRecursive.bind(qb),
    $withSql: qb.withSql.bind(qb),
    $from: qb.from.bind(qb),
    $close: adapter.close.bind(adapter),
    $withOptions: qb.withOptions.bind(qb),
  } as unknown as OrchidORM<T>;

  const tableInstances = assignTablesToOrm(
    tables,
    result as OrchidORMDbTables<T>,
    adapter,
    qb,
    asyncStorage,
    commonOptions,
    schema,
  );

  setDbAwareInstance?.(result);

  for (const key in tables) {
    const table = tableInstances[key] as unknown as {
      init?(orm: unknown): void;
      q: QueryData;
    };

    if (table.init) {
      table.init(result);
      // assign before and after hooks from table.query to the table base query
      Object.assign(result[key].baseQuery.q, table.q);
    }
  }

  return result as unknown as OrchidORM<T>;
};

export const orchidORMWithAdapter = <T extends TableClasses>(
  options: OrchidOrmParam<
    ({ db: Query } | { adapter: Adapter }) & DbSharedOptions
  >,
  tables: T,
): OrchidORM<T> => privateOrchidORMWithAdapter(options, tables);

function $getAdapter(this: OrchidORM) {
  return this.$qb.$getAdapter();
}
