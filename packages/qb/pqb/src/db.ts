import { Query, SelectableFromShape } from './query';
import {
  QueryMethods,
  handleResult,
  WhereQueryBuilder,
  OnQueryBuilder,
  logParamToLogObject,
  QueryLogOptions,
} from './queryMethods';
import { QueryData, SelectQueryData, ToSqlOptions } from './sql';
import { AdapterOptions, Adapter } from './adapter';
import {
  ColumnsShape,
  getColumnTypes,
  ColumnType,
  getTableData,
  DefaultColumnTypes,
  columnTypes,
} from './columns';
import { QueryError, QueryErrorName } from './errors';
import {
  DbBase,
  ColumnsShapeBase,
  DefaultSelectColumns,
  applyMixins,
  pushOrNewArray,
  ColumnShapeOutput,
  ColumnTypesBase,
  SinglePrimaryKey,
  snakeCaseKey,
  toSnakeCase,
  AdapterBase,
  Sql,
  QueryThen,
  QueryCatch,
  ColumnsParsers,
} from 'orchid-core';
import { q } from './sql/common';
import { inspect } from 'util';
import { AsyncLocalStorage } from 'node:async_hooks';

export type NoPrimaryKeyOption = 'error' | 'warning' | 'ignore';

export type DbOptions<CT extends ColumnTypesBase> = (
  | { adapter: Adapter }
  | Omit<AdapterOptions, 'log'>
) &
  QueryLogOptions & {
    // concrete column types or a callback for overriding standard column types
    // this types will be used in tables to define their columns
    columnTypes?: CT | ((t: DefaultColumnTypes) => CT);
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
} & QueryLogOptions;

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
  Relations extends Query['relations'] = Query['relations'],
  CT extends ColumnTypesBase = DefaultColumnTypes,
  Data = Pick<ColumnShapeOutput<Shape>, DefaultSelectColumns<Shape>[number]>[],
> extends DbBase<Adapter, Table, Shape, CT>,
    QueryMethods {
  new (
    adapter: Adapter,
    queryBuilder: Db<Table, Shape, Relations, CT>,
    table?: Table,
    shape?: Shape,
    options?: DbTableOptions,
  ): this;
  queryBuilder: Db;
  whereQueryBuilder: Query['whereQueryBuilder'];
  onQueryBuilder: Query['onQueryBuilder'];
  primaryKeys: Query['primaryKeys'];
  query: QueryData;
  selectable: SelectableFromShape<Shape, Table>;
  returnType: Query['returnType'];
  then: QueryThen<Data>;
  catch: QueryCatch<Data>;
  windows: Query['windows'];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  relations: Relations;
  relationsQueries: Record<string, Query>;
  withData: Query['withData'];
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError<this>;
  isSubQuery: false;
  meta: {
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
  Relations extends Query['relations'] = Query['relations'],
  CT extends ColumnTypesBase = DefaultColumnTypes,
> implements Query
{
  whereQueryBuilder = WhereQueryBuilder;
  onQueryBuilder = OnQueryBuilder;

  constructor(
    public adapter: Adapter,
    public queryBuilder: Db,
    public table: Table = undefined as Table,
    public shape: Shape = anyShape as Shape,
    public columnTypes: CT,
    transactionStorage: AsyncLocalStorage<AdapterBase>,
    options: DbTableOptions,
  ) {
    const tableData = getTableData();
    this.internal = { ...tableData, transactionStorage };
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
      }
    }

    if (hasCustomName) {
      const list: string[] = [];
      for (const key in shape) {
        const column = shape[key];
        list.push(
          column.data.name ? `${q(column.data.name)} AS ${q(key)}` : q(key),
        );
      }
      this.internal.columnsForSelectAll = list;
    }

    this.query = {
      adapter,
      shape: shape as ColumnsShapeBase,
      handleResult,
      logger,
      log: logParamToLogObject(logger, options.log),
      autoPreparedStatements: options.autoPreparedStatements ?? false,
      parsers: hasParsers ? parsers : undefined,
    } as QueryData;

    if (options?.schema) {
      this.query.schema = options.schema;
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
    const { toSql } = this;

    this.columns = columns as (keyof ColumnShapeOutput<Shape>)[];
    this.defaultSelectColumns = columns.filter(
      (column) => !shape[column as keyof typeof shape].data.isHidden,
    ) as DefaultSelectColumns<Shape>;

    const defaultSelect =
      this.defaultSelectColumns.length === columns.length
        ? undefined
        : this.defaultSelectColumns;

    this.toSql = defaultSelect
      ? function <T extends Query>(this: T, options?: ToSqlOptions): Sql {
          const q = this.clone();
          if (!(q.query as SelectQueryData).select) {
            (q.query as SelectQueryData).select = defaultSelect as string[];
          }
          return toSql.call(q, options);
        }
      : toSql;

    this.relations = {} as Relations;
    this.relationsQueries = {};

    modifyQuery?.forEach((cb) => cb(this));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.error = class extends QueryError {
      constructor(message?: string) {
        super(self, message);
      }
    };
  }

  [inspect.custom]() {
    return `QueryObject<${this.table}>`;
  }
}

applyMixins(Db, [QueryMethods]);
Db.prototype.constructor = Db;

export type DbResult<CT extends ColumnTypesBase> = Db<
  string,
  Record<string, never>,
  Query['relations'],
  ColumnTypesBase extends CT ? DefaultColumnTypes : CT
> & {
  <Table extends string, Shape extends ColumnsShape = ColumnsShape>(
    table: Table,
    shape?:
      | ((t: ColumnTypesBase extends CT ? DefaultColumnTypes : CT) => Shape)
      | Shape,
    options?: DbTableOptions,
  ): Db<Table, Shape>;

  adapter: Adapter;
  close: Adapter['close'];
};

export const createDb = <CT extends ColumnTypesBase>({
  log,
  logger,
  columnTypes: ctOrFn = columnTypes as unknown as CT,
  snakeCase,
  nowSQL,
  ...options
}: DbOptions<CT>): DbResult<CT> => {
  const adapter = 'adapter' in options ? options.adapter : new Adapter(options);
  const commonOptions = {
    log,
    logger,
    autoPreparedStatements: options.autoPreparedStatements ?? false,
    noPrimaryKey: options.noPrimaryKey ?? 'error',
    snakeCase,
  };

  const ct = typeof ctOrFn === 'function' ? ctOrFn(columnTypes) : ctOrFn;

  if (snakeCase) {
    (ct as { [snakeCaseKey]?: boolean })[snakeCaseKey] = true;
  }

  const transactionStorage = new AsyncLocalStorage<AdapterBase>();

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
      shape?: ((t: CT) => Shape) | Shape,
      options?: DbTableOptions,
    ): Db<Table, Shape, Query['relations'], CT> => {
      return new Db<Table, Shape, Query['relations'], CT>(
        adapter,
        qb as unknown as Db,
        table as Table,
        typeof shape === 'function' ? getColumnTypes(ct, shape, nowSQL) : shape,
        ct,
        transactionStorage,
        { ...commonOptions, ...options },
      );
    },
    qb,
    { adapter, close: () => adapter.close() },
  );

  // Set all methods from prototype to the db instance (needed for transaction at least):
  Object.getOwnPropertyNames(Db.prototype).forEach((name) => {
    (db as unknown as Record<string, unknown>)[name] =
      Db.prototype[name as keyof typeof Db.prototype];
  });

  return db as unknown as DbResult<CT>;
};
