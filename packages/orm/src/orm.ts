import {
  makeColumnTypes,
  Db,
  DbTableOptions,
  DbTableOptionScopes,
  FromArg,
  FromResult,
  NoPrimaryKeyOption,
  Query,
  QueryData,
  defaultSchemaConfig,
  DbSharedOptions,
  _initQueryBuilder,
  AdapterBase,
  ColumnSchemaConfig,
  MaybeArray,
  QueryLogOptions,
  RecordUnknown,
  TransactionState,
  Column,
} from 'pqb';
import {
  ORMTableInputToQueryBuilder,
  ORMTableInput,
  TableClasses,
  BaseTableClass,
} from './baseTable';
import { applyRelations } from './relations/relations';
import {
  transaction,
  ensureTransaction,
  isInTransaction,
  afterCommit,
} from './transaction';
import { AsyncLocalStorage } from 'node:async_hooks';

interface FromQuery extends Query {
  returnType: 'all';
}

export type OrchidORM<T extends TableClasses = TableClasses> = {
  [K in keyof T]: T[K] extends { new (): infer R extends ORMTableInput }
    ? ORMTableInputToQueryBuilder<R>
    : never;
} & OrchidORMMethods;

interface OrchidORMMethods {
  /**
   * @see import('pqb').Transaction.prototype.transaction
   */
  $transaction: typeof transaction;
  /**
   * @see import('pqb').Transaction.prototype.ensureTransaction
   */
  $ensureTransaction: typeof ensureTransaction;
  /**
   * @see import('pqb').Transaction.prototype.isInTransaction
   */
  $isInTransaction: typeof isInTransaction;
  /**
   * @see import('pqb').Transaction.prototype.afterCommit
   */
  $afterCommit: typeof afterCommit;
  $adapter: AdapterBase;
  $qb: Db;

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

  $close(): Promise<void>;
}

export type OrchidOrmParam<Options> = true | null extends true
  ? 'Set strict: true to tsconfig'
  : Options;

export const orchidORMWithAdapter = <T extends TableClasses>(
  {
    log,
    logger,
    autoPreparedStatements,
    noPrimaryKey = 'error',
    ...options
  }: OrchidOrmParam<
    ({ db: Query } | { adapter: AdapterBase }) & DbSharedOptions
  >,
  tables: T,
): OrchidORM<T> => {
  const commonOptions: QueryLogOptions & {
    autoPreparedStatements?: boolean;
    noPrimaryKey?: NoPrimaryKeyOption;
  } = {
    log,
    logger,
    autoPreparedStatements,
    noPrimaryKey,
  };

  let adapter: AdapterBase;
  let transactionStorage;
  let qb: Db;
  if ('db' in options) {
    adapter = options.db.q.adapter;
    transactionStorage = options.db.internal.transactionStorage;
    qb = options.db.qb as Db;
  } else {
    adapter = options.adapter;

    transactionStorage = new AsyncLocalStorage<TransactionState>();

    qb = _initQueryBuilder(
      adapter,
      makeColumnTypes(defaultSchemaConfig),
      transactionStorage,
      commonOptions,
      options,
    );
  }

  const result = {
    $transaction: transaction,
    $ensureTransaction: ensureTransaction,
    $isInTransaction: isInTransaction,
    $afterCommit: afterCommit,
    $adapter: adapter,
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
  } as unknown as OrchidORM;

  const tableInstances: Record<string, ORMTableInput> = {};

  for (const key in tables) {
    if (key[0] === '$') {
      throw new Error(`Table class name must not start with $`);
    }

    const tableClass = tables[key];
    const table = (
      tableClass as unknown as { instance(): ORMTableInput }
    ).instance();
    tableInstances[key] = table;

    const options: DbTableOptions<unknown, string, Column.Shape.QueryInit> = {
      ...commonOptions,
      schema: table.schema,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      qb as any,
      table.table,
      table.columns.shape,
      table.types,
      transactionStorage,
      options,
      table.constructor.prototype.columns?.data ?? {},
    );

    (dbTable as unknown as { definedAs: string }).definedAs = key;
    (dbTable as unknown as { db: unknown }).db = result;
    (dbTable as unknown as { filePath: string }).filePath = table.filePath;
    (dbTable as unknown as { name: string }).name = table.constructor.name;

    (result as RecordUnknown)[key] = dbTable;
  }

  applyRelations(qb, tableInstances, result);

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

  const db = result as unknown as OrchidORM<T>;
  db.$adapter;

  return result as unknown as OrchidORM<T>;
};
