import {
  DbDomainArg,
  DbExtension,
  GeneratorIgnore,
  Query,
  QueryInternal,
  SelectableFromShape,
} from './query';
import {
  handleResult,
  logParamToLogObject,
  QueryMethods,
} from '../queryMethods';
import { QueryData, QueryScopes } from '../sql';
import { Adapter, AdapterOptions, QueryArraysResult } from '../adapter';
import {
  anyShape,
  DefaultColumnTypes,
  getColumnTypes,
  makeColumnTypes,
} from '../columns';
import { NotFoundError, QueryError, QueryErrorName } from '../errors';
import {
  applyMixins,
  ColumnSchemaConfig,
  ColumnShapeInput,
  ColumnShapeOutput,
  ColumnsParsers,
  ColumnTypeBase,
  DefaultSelectColumns,
  DefaultSelectOutput,
  DynamicSQLArg,
  EmptyObject,
  emptyObject,
  IsQuery,
  MaybeArray,
  pushOrNewArray,
  QueryCatch,
  QueryColumn,
  QueryColumns,
  QueryColumnsInit,
  QueryLogOptions,
  QueryMetaBase,
  QueryThenShallowSimplifyArr,
  RecordString,
  RecordUnknown,
  snakeCaseKey,
  SQLQueryArgs,
  StaticSQLArgs,
  toSnakeCase,
  TransactionState,
} from 'orchid-core';
import { inspect } from 'node:util';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DynamicRawSQL, raw, RawSQL } from '../sql/rawSql';
import { ScopeArgumentQuery } from '../queryMethods/scope';
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
  TableDataItemsUniqueColumns,
  TableDataItemsUniqueColumnTuples,
  TableDataItemsUniqueConstraints,
  UniqueQueryTypeOrExpression,
} from '../tableData';
import {
  applyComputedColumns,
  ComputedColumnsFromOptions,
  ComputedOptionsFactory,
} from '../modules/computed';
import { DbSqlQuery, performQuery } from './dbSqlQuery';

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
  generatorIgnore?: GeneratorIgnore;
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
  ColumnTypes,
  Table extends string | undefined,
  Shape extends QueryColumns,
> extends QueryLogOptions {
  schema?: string;
  /**
   * Prepare all SQL queries before executing,
   * true by default
   */
  autoPreparedStatements?: boolean;
  noPrimaryKey?: NoPrimaryKeyOption;
  snakeCase?: boolean;
  /**
   * Default language for the full text search
   */
  language?: string;
  /**
   * See {@link ScopeMethods}
   */
  scopes?: DbTableOptionScopes<Table, Shape>;
  /**
   * See {@link SoftDeleteMethods}
   */
  softDelete?: SoftDeleteOption<Shape>;
  /**
   * Table comment, for migrations generator
   */
  comment?: string;
  /**
   * Computed SQL or JS columns definitions
   */
  computed?: ComputedOptionsFactory<ColumnTypes, Shape>;
  /**
   * For customizing `now()` sql, used in soft delete
   */
  nowSQL?: string;
}

/**
 * See {@link ScopeMethods}
 */
export type DbTableOptionScopes<
  Table extends string | undefined,
  Shape extends QueryColumns,
  Keys extends string = string,
> = { [K in Keys]: (q: ScopeArgumentQuery<Table, Shape>) => IsQuery };

// Type of data returned from the table query by default, doesn't include computed columns.
// `const user: User[] = await db.user;`
export type QueryDefaultReturnData<Shape extends QueryColumnsInit> = {
  [K in DefaultSelectColumns<Shape>]: Shape[K]['outputType'];
};

interface TableMeta<
  Table extends string | undefined,
  Shape extends QueryColumnsInit,
  ShapeWithComputed extends QueryColumnsInit,
  Scopes extends RecordUnknown | undefined,
> extends QueryMetaBase<{ [K in keyof Scopes]: true }> {
  kind: 'select';
  defaults: {
    [K in keyof Shape as unknown extends Shape[K]['data']['default']
      ? never
      : K]: true;
  };
  selectable: SelectableFromShape<ShapeWithComputed, Table>;
  defaultSelect: DefaultSelectColumns<Shape>;
}

export interface QueryBuilder extends Query {
  returnType: undefined;
}

export class Db<
    Table extends string | undefined = undefined,
    Shape extends QueryColumnsInit = QueryColumnsInit,
    PrimaryKeys = never,
    UniqueColumns = never,
    UniqueColumnTuples = never,
    UniqueConstraints = never,
    ColumnTypes = DefaultColumnTypes<ColumnSchemaConfig>,
    ShapeWithComputed extends QueryColumnsInit = Shape,
    Scopes extends RecordUnknown | undefined = EmptyObject,
  >
  extends QueryMethods<ColumnTypes>
  implements Query
{
  declare q: QueryData;
  declare __isQuery: true;
  baseQuery: Query;
  columns: (keyof Shape)[];
  declare outputType: DefaultSelectOutput<Shape>;
  declare inputType: ColumnShapeInput<Shape>;
  declare result: Pick<Shape, DefaultSelectColumns<Shape>>; // Pick is optimal
  declare returnType: undefined;
  declare then: QueryThenShallowSimplifyArr<QueryDefaultReturnData<Shape>>;
  declare windows: EmptyObject;
  relations: EmptyObject;
  relationQueries: EmptyObject;
  declare withData: EmptyObject;
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError<this>;
  declare meta: TableMeta<Table, Shape, ShapeWithComputed, Scopes>;
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
  declare catch: QueryCatch;

  constructor(
    public adapter: Adapter,
    public qb: QueryBuilder,
    public table: Table = undefined as Table,
    public shape: ShapeWithComputed = anyShape as ShapeWithComputed,
    public columnTypes: ColumnTypes,
    transactionStorage: AsyncLocalStorage<TransactionState>,
    options: DbTableOptions<ColumnTypes, Table, ShapeWithComputed>,
    tableData: TableData = {},
  ) {
    super();

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
      nowSQL: options.nowSQL,
      tableData,
    } as QueryInternal;

    this.baseQuery = this as Query;
    this.relations = {};
    this.relationQueries = {};

    const logger = options.logger || console;

    const parsers = {} as ColumnsParsers;
    let hasParsers = false;
    let modifyQuery: ((q: Query) => void)[] | undefined = undefined;
    let prepareSelectAll = false;
    const { snakeCase } = options;
    for (const key in shape) {
      const column = shape[key] as unknown as ColumnTypeBase;
      column.data.key = key;

      if (column._parse) {
        hasParsers = true;
        parsers[key] = column._parse;
      }

      if (column.data.name) {
        prepareSelectAll = true;
      } else if (snakeCase) {
        const snakeName = toSnakeCase(key);
        if (snakeName !== key) {
          prepareSelectAll = true;
          column.data.name = snakeName;
        }
      }

      if (column.data.explicitSelect) {
        prepareSelectAll = true;
      }

      const { modifyQuery: mq } = column.data;
      if (mq) {
        modifyQuery = pushOrNewArray(modifyQuery, (q: Query) => mq(q, column));
      }

      if (typeof column.data.default === 'function') {
        const arr = this.internal.runtimeDefaultColumns;
        if (!arr) this.internal.runtimeDefaultColumns = [key];
        else arr.push(key);

        if (!column.data.runtimeDefault) {
          const {
            data: { default: def, encode },
          } = column;

          column.data.runtimeDefault = encode
            ? () => encode(def())
            : (def as () => unknown);
        }
      }
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

    this.columns = columns as (keyof ColumnShapeOutput<Shape>)[];

    if (options.computed) applyComputedColumns(this, options.computed);

    if (prepareSelectAll) {
      const selectAllShape: RecordUnknown = (this.q.selectAllShape = {});
      const list: string[] = [];
      for (const key in shape) {
        const column = shape[key] as unknown as ColumnTypeBase;
        if (!column.data.explicitSelect) {
          list.push(
            column.data.name ? `"${column.data.name}" "${key}"` : `"${key}"`,
          );
          selectAllShape[key] = column;
        }
      }
      this.q.selectAllColumns = list;
    } else {
      this.q.selectAllShape = shape;
    }

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
        const q = (options.scopes[key](this) as Query).q;

        (scopes as RecordUnknown)[key] = {
          and: q.and,
          or: q.or,
        };
      }

      if (scopes.default) {
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
  get query(): DbSqlQuery {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const q = this;
    let query = q._query;
    if (!query) {
      q._query = query = Object.assign(
        (...args: SQLQueryArgs) => performQuery(q, args, 'query'),
        {
          async records(...args: SQLQueryArgs) {
            const { rows } = await performQuery(q, args, 'query');
            return rows;
          },
          async take(...args: SQLQueryArgs) {
            const {
              rows: [row],
            } = await performQuery(q, args, 'query');
            if (!row) throw new NotFoundError(q);
            return row;
          },
          async takeOptional(...args: SQLQueryArgs) {
            const { rows } = await performQuery(q, args, 'query');
            return rows[0];
          },
          async rows(...args: SQLQueryArgs) {
            const { rows } = await performQuery(q, args, 'arrays');
            return rows;
          },
          async pluck(...args: SQLQueryArgs) {
            const { rows } = await performQuery(q, args, 'arrays');
            return rows.map((row) => row[0]);
          },
          async get(...args: SQLQueryArgs) {
            const {
              rows: [row],
            } = await performQuery(q, args, 'arrays');
            if (!row) throw new NotFoundError(q);
            return row[0];
          },
          async getOptional(...args: SQLQueryArgs) {
            const { rows } = await performQuery(q, args, 'arrays');
            return rows[0]?.[0];
          },
        },
      ) as never;
    }
    return query;
  }
  private _query?: DbSqlQuery;

  /**
   * Performs a SQL query, returns a db result with array of arrays instead of objects:
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

  /**
   * In snake case mode, or when columns have custom names,
   * use this method to exchange a db column name to its runtime key.
   */
  columnNameToKey(name: string): string | undefined {
    let map = this.internal.columnNameToKeyMap;
    if (!map) {
      this.internal.columnNameToKeyMap = map = new Map<string, string>();

      const { shape } = this;
      for (const key in this.shape) {
        const column = shape[key];
        map.set(column.data.name ?? key, key);
      }
    }

    return map.get(name);
  }
}

applyMixins(Db, [QueryMethods]);
Db.prototype.constructor = Db;

// Function to build a new table instance.
export interface DbTableConstructor<ColumnTypes> {
  <
    Table extends string,
    Shape extends QueryColumnsInit,
    Data extends MaybeArray<TableDataItem>,
    Options extends DbTableOptions<ColumnTypes, Table, Shape>,
  >(
    table: Table,
    shape?: ((t: ColumnTypes) => Shape) | Shape,
    tableData?: TableDataFn<Shape, Data>,
    options?: Options,
  ): Db<
    Table,
    Shape,
    keyof ShapeColumnPrimaryKeys<Shape> extends never
      ? never
      : ShapeColumnPrimaryKeys<Shape>,
    ShapeUniqueColumns<Shape> | TableDataItemsUniqueColumns<Shape, Data>,
    TableDataItemsUniqueColumnTuples<Shape, Data>,
    UniqueConstraints<Shape> | TableDataItemsUniqueConstraints<Data>,
    ColumnTypes,
    Shape & ComputedColumnsFromOptions<Options['computed']>,
    MapTableScopesOption<Options>
  >;
}

export type MapTableScopesOption<T> = T extends { scopes: RecordUnknown }
  ? T extends { softDelete: true | PropertyKey }
    ? T['scopes'] & { nonDeleted: unknown }
    : T['scopes']
  : T extends { softDelete: true | PropertyKey }
  ? { nonDeleted: unknown }
  : EmptyObject;

export interface DbResult<ColumnTypes>
  extends Db<string, never, never, never, never, never, ColumnTypes>,
    DbTableConstructor<ColumnTypes> {
  adapter: Adapter;
  close: Adapter['close'];
  sql<T = unknown>(...args: StaticSQLArgs): RawSQL<QueryColumn<T>, ColumnTypes>;
  sql<T = unknown>(
    ...args: [DynamicSQLArg<QueryColumn<T>>]
  ): DynamicRawSQL<QueryColumn<T>, ColumnTypes>;
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
 *   name: t.string(),
 *   password: t.varchar(100),
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
    nowSQL: options.nowSQL,
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

  const { nowSQL } = options;
  const tableConstructor: DbTableConstructor<ColumnTypes> = (
    table,
    shape,
    dataFn,
    options,
  ) => {
    return new Db(
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
  };

  const db = Object.assign(tableConstructor, qb, {
    adapter,
    close: () => adapter.close(),
  });

  Object.setPrototypeOf(db, Db.prototype);

  // bind column types to the `sql` method
  db.sql = (...args: unknown[]) => {
    const sql = (raw as any)(...args);
    sql.columnTypes = ct;
    return sql;
  };

  return db as never;
};

export const _initQueryBuilder = (
  adapter: Adapter,
  columnTypes: unknown,
  transactionStorage: AsyncLocalStorage<TransactionState>,
  commonOptions: DbTableOptions<unknown, undefined, QueryColumns>,
  options: DbSharedOptions,
): Db => {
  const qb = new Db(
    adapter,
    undefined as unknown as QueryBuilder,
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
  qb.internal.generatorIgnore = options.generatorIgnore;

  return (qb.qb = qb as never);
};
