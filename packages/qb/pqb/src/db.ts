import {
  ColumnsParsers,
  DefaultSelectColumns,
  defaultsKey,
  Query,
} from './query';
import {
  QueryMethods,
  handleResult,
  ThenResult,
  WhereQueryBuilder,
  OnQueryBuilder,
  logParamToLogObject,
  QueryLogOptions,
} from './queryMethods';
import { QueryData, SelectQueryData, Sql, ToSqlOptions } from './sql';
import { AdapterOptions, Adapter } from './adapter';
import {
  ColumnsShape,
  ColumnShapeOutput,
  ColumnShapeInput,
  ColumnTypesBase,
  getColumnTypes,
  SinglePrimaryKey,
  ColumnType,
  getTableData,
  DefaultColumnTypes,
  columnTypes,
} from './columns';
import { applyMixins, pushOrNewArray, StringKey } from './utils';
import { QueryError, QueryErrorName } from './errors';

export type NoPrimaryKeyOption = 'error' | 'warning' | 'ignore';

export type DbOptions<CT extends ColumnTypesBase> = (
  | { adapter: Adapter }
  | Omit<AdapterOptions, 'log'>
) &
  QueryLogOptions & {
    columnTypes?: CT | ((t: DefaultColumnTypes) => CT);
    autoPreparedStatements?: boolean;
    noPrimaryKey?: NoPrimaryKeyOption;
  };

export type DbTableOptions = {
  schema?: string;
  // prepare all SQL queries before executing
  // true by default
  autoPreparedStatements?: boolean;
  noPrimaryKey?: NoPrimaryKeyOption;
} & QueryLogOptions;

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
  Relations extends Query['relations'] = Query['relations'],
  CT extends ColumnTypesBase = DefaultColumnTypes,
> extends QueryMethods {
  new (
    adapter: Adapter,
    queryBuilder: Db<Table, Shape, Relations, CT>,
    table?: Table,
    shape?: Shape,
    options?: DbTableOptions,
  ): this;

  adapter: Adapter;
  columns: (keyof ColumnShapeOutput<Shape>)[];

  queryBuilder: Db;
  columnTypes: CT;
  whereQueryBuilder: Query['whereQueryBuilder'];
  onQueryBuilder: Query['onQueryBuilder'];
  table: Table;
  shape: Shape;
  singlePrimaryKey: SinglePrimaryKey<Shape>;
  primaryKeys: Query['primaryKeys'];
  type: ColumnShapeOutput<Shape>;
  inputType: ColumnShapeInput<Shape>;
  query: QueryData;
  result: Pick<Shape, DefaultSelectColumns<Shape>[number]>;
  hasSelect: Query['hasSelect'];
  hasWhere: boolean;
  selectable: { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
    [K in keyof Shape as `${Table}.${StringKey<K>}`]: {
      as: K;
      column: Shape[K];
    };
  };
  returnType: Query['returnType'];
  then: ThenResult<
    Pick<ColumnShapeOutput<Shape>, DefaultSelectColumns<Shape>[number]>[]
  >;
  // TODO: remove tableAlias
  tableAlias: undefined;
  joinedTables: Query['joinedTables'];
  windows: Query['windows'];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  columnsParsers?: ColumnsParsers;
  relations: Relations;
  withData: Query['withData'];
  error: new (
    message: string,
    length: number,
    name: QueryErrorName,
  ) => QueryError<this>;
  isSubQuery: false;
  [defaultsKey]: Record<
    {
      [K in keyof Shape]: Shape[K]['hasDefault'] extends true ? K : never;
    }[keyof Shape],
    true
  >;
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
    options: DbTableOptions,
  ) {
    this.__table = this as Query;

    const logger = options.logger || console;
    this.query = {
      adapter,
      handleResult: handleResult,
      logger,
      log: logParamToLogObject(logger, options.log),
      autoPreparedStatements: options.autoPreparedStatements ?? false,
    } as QueryData;

    if (options?.schema) {
      this.query.schema = options.schema;
    }

    this.primaryKeys = Object.keys(shape).filter(
      (key) => shape[key].isPrimaryKey,
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
      (column) => !shape[column as keyof typeof shape].isHidden,
    ) as DefaultSelectColumns<Shape>;

    const defaultSelect =
      this.defaultSelectColumns.length === columns.length
        ? undefined
        : this.defaultSelectColumns;

    const columnsParsers = {} as ColumnsParsers;
    let hasParsers = false;
    let modifyQuery: ((q: Query) => void)[] | undefined = undefined;
    for (const key in shape) {
      const column = shape[key];
      if (column.parseFn) {
        hasParsers = true;
        columnsParsers[key] = column.parseFn;
      }

      if (column.data.modifyQuery) {
        modifyQuery = pushOrNewArray(modifyQuery, column.data.modifyQuery);
      }
    }
    this.columnsParsers = hasParsers ? columnsParsers : undefined;

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

    modifyQuery?.forEach((cb) => cb(this));

    this.error = class extends QueryError {};
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
  ...options
}: DbOptions<CT>): DbResult<CT> => {
  const adapter = 'adapter' in options ? options.adapter : new Adapter(options);
  const commonOptions = {
    log,
    logger,
    autoPreparedStatements: options.autoPreparedStatements ?? false,
    noPrimaryKey: options.noPrimaryKey ?? 'error',
  };

  const ct = typeof ctOrFn === 'function' ? ctOrFn(columnTypes) : ctOrFn;

  const qb = new Db(
    adapter,
    undefined as unknown as Db,
    undefined,
    anyShape,
    ct,
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
        typeof shape === 'function' ? getColumnTypes(ct, shape) : shape,
        ct,
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
