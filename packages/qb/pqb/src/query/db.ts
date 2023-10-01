import { Query, SelectableFromShape } from './query';
import {
  QueryMethods,
  handleResult,
  OnQueryBuilder,
  logParamToLogObject,
  QueryLogOptions,
} from '../queryMethods';
import { QueryData, SelectQueryData, ToSQLOptions } from '../sql';
import {
  AdapterOptions,
  Adapter,
  QueryResult,
  QueryArraysResult,
} from '../adapter';
import {
  ColumnsShape,
  getColumnTypes,
  ColumnType,
  getTableData,
  DefaultColumnTypes,
  columnTypes,
} from '../columns';
import { QueryError, QueryErrorName } from '../errors';
import {
  DbBase,
  ColumnsShapeBase,
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
  ColumnTypesBase,
} from 'orchid-core';
import { inspect } from 'node:util';
import { AsyncLocalStorage } from 'node:async_hooks';
import { templateLiteralToSQL } from '../sql/rawSql';
import { RelationsBase } from '../relations';

export type NoPrimaryKeyOption = 'error' | 'warning' | 'ignore';

export type DbOptions<ColumnTypes extends ColumnTypesBase> = (
  | { adapter: Adapter }
  | Omit<AdapterOptions, 'log'>
) &
  QueryLogOptions & {
    // concrete column types or a callback for overriding standard column types
    // this types will be used in tables to define their columns
    columnTypes?: ColumnTypes | ((t: DefaultColumnTypes) => ColumnTypes);
    autoPreparedStatements?: boolean;
    noPrimaryKey?: NoPrimaryKeyOption;
    // when set to true, all columns will be translated to `snake_case` when querying database
    snakeCase?: boolean;
    // if `now()` for some reason doesn't suite your timestamps, provide a custom SQL for it
    nowSQL?: string;
  };

export type DbTableOptions = {
  schema?: string;
  // prepare all SQL queries before executing
  // true by default
  autoPreparedStatements?: boolean;
  noPrimaryKey?: NoPrimaryKeyOption;
  snakeCase?: boolean;
  // default language for the full text search
  language?: string;
} & QueryLogOptions;

// Type of data returned from the table query by default, doesn't include computed columns.
// `const user: User[] = await db.user;`
export type QueryDefaultReturnData<Shape extends ColumnsShapeBase> = Pick<
  ColumnShapeOutput<Shape>,
  DefaultSelectColumns<Shape>[number]
>[];

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
  Relations extends RelationsBase = EmptyObject,
  ColumnTypes = DefaultColumnTypes,
  ShapeWithComputed extends ColumnsShape = Shape,
  Data = QueryDefaultReturnData<Shape>,
> extends DbBase<Adapter, Table, Shape, ColumnTypes, ShapeWithComputed>,
    QueryMethods<ColumnTypes> {
  new (
    adapter: Adapter,
    queryBuilder: Db<Table, Shape, Relations, ColumnTypes>,
    table?: Table,
    shape?: Shape,
    options?: DbTableOptions,
  ): this;
  internal: Query['internal'];
  queryBuilder: Db;
  onQueryBuilder: Query['onQueryBuilder'];
  primaryKeys: Query['primaryKeys'];
  q: QueryData;
  selectable: SelectableFromShape<ShapeWithComputed, Table>;
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
    defaults: Record<
      {
        [K in keyof Shape]: undefined extends Shape[K]['data']['default']
          ? never
          : K;
      }[keyof Shape],
      true
    >;
  };
}

export const anyShape = {} as Record<string, ColumnType>;

export class Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
  Relations extends RelationsBase = EmptyObject,
  ColumnTypes = DefaultColumnTypes,
  ShapeWithComputed extends ColumnsShape = Shape,
> implements Query
{
  constructor(
    public adapter: Adapter,
    public queryBuilder: Db,
    public table: Table = undefined as Table,
    public shape: ShapeWithComputed = anyShape as ShapeWithComputed,
    public columnTypes: ColumnTypes,
    transactionStorage: AsyncLocalStorage<TransactionState>,
    options: DbTableOptions,
  ) {
    const tableData = getTableData();

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.internal = {
      ...tableData,
      transactionStorage,
    };

    this.baseQuery = this as Query;

    const logger = options.logger || console;

    const parsers = {} as ColumnsParsers;
    let hasParsers = false;
    let modifyQuery: ((q: Query) => void)[] | undefined = undefined;
    let hasCustomName = false;
    const { snakeCase } = options;
    for (const key in shape) {
      const column = shape[key];
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
        const column = shape[key];
        list.push(
          column.data.name ? `"${column.data.name}" AS "${key}"` : `"${key}"`,
        );
      }
      this.internal.columnsForSelectAll = list;
    }

    this.q = {
      adapter,
      shape: shape as ColumnsShapeBase,
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

export type DbResult<ColumnTypes> = Db<
  string,
  Record<string, never>,
  EmptyObject,
  ColumnTypes
> & {
  <Table extends string, Shape extends ColumnsShape = ColumnsShape>(
    table: Table,
    shape?: ((t: ColumnTypes) => Shape) | Shape,
    options?: DbTableOptions,
  ): Db<Table, Shape, EmptyObject>;

  adapter: Adapter;
  close: Adapter['close'];
};

export const createDb = <
  ColumnTypes extends ColumnTypesBase = DefaultColumnTypes,
>({
  log,
  logger,
  columnTypes: ctOrFn = columnTypes as unknown as ColumnTypes,
  snakeCase,
  nowSQL,
  ...options
}: DbOptions<ColumnTypes>): DbResult<ColumnTypes> => {
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
      ? (ctOrFn as unknown as (t: DefaultColumnTypes) => ColumnTypes)(
          columnTypes,
        )
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

  const db = Object.assign(
    <Table extends string, Shape extends ColumnsShape = ColumnsShape>(
      table: Table,
      shape?: ((t: ColumnTypes) => Shape) | Shape,
      options?: DbTableOptions,
    ): Db<Table, Shape, EmptyObject, ColumnTypes> => {
      return new Db<Table, Shape, EmptyObject, ColumnTypes>(
        adapter,
        qb as unknown as Db,
        table as Table,
        typeof shape === 'function'
          ? getColumnTypes(ct, shape, nowSQL, options?.language)
          : shape,
        ct,
        transactionStorage,
        { ...commonOptions, ...options },
      );
    },
    qb,
    { adapter, close: () => adapter.close() },
  );

  // Set all methods from prototype to the db instance (needed for transaction at least):
  for (const name of Object.getOwnPropertyNames(Db.prototype)) {
    (db as unknown as Record<string, unknown>)[name] =
      Db.prototype[name as keyof typeof Db.prototype];
  }

  return db as unknown as DbResult<ColumnTypes>;
};
