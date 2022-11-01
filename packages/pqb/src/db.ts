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
import { QueryData, SelectQueryData, Sql } from './sql';
import { AdapterOptions, Adapter } from './adapter';
import {
  ColumnsShape,
  columnTypes,
  ColumnShapeOutput,
  TableSchema,
  ColumnShapeInput,
  ColumnTypes,
  ColumnTypesBase,
  getColumnTypes,
} from './columnSchema';
import { applyMixins } from './utils';
import { StringKey } from './common';

export type DbTableOptions = {
  schema?: string;
} & QueryLogOptions;

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
  Relations extends Query['relations'] = Query['relations'],
> extends QueryMethods {
  new (
    adapter: Adapter,
    queryBuilder: Db,
    table?: Table,
    shape?: Shape,
    options?: DbTableOptions,
  ): this;

  adapter: Adapter;
  queryBuilder: Db;
  whereQueryBuilder: Query['whereQueryBuilder'];
  table: Table;
  shape: Shape;
  schema: TableSchema<Shape>;
  type: ColumnShapeOutput<Shape>;
  inputType: ColumnShapeInput<Shape>;
  returnType: 'all';
  then: ThenResult<
    Pick<ColumnShapeOutput<Shape>, DefaultSelectColumns<Shape>[number]>[]
  >;
  query: QueryData;
  columns: (keyof ColumnShapeOutput<Shape>)[];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  columnsParsers?: ColumnsParsers;
  result: Pick<Shape, DefaultSelectColumns<Shape>[number]>;
  hasSelect: false;
  hasWhere: boolean;
  selectable: { [K in keyof Shape]: { as: K; column: Shape[K] } } & {
    [K in keyof Shape as `${Table}.${StringKey<K>}`]: {
      as: K;
      column: Shape[K];
    };
  };
  tableAlias: undefined;
  windows: PropertyKey[];
  withData: Query['withData'];
  joinedTables: Query['joinedTables'];
  relations: Relations;
  [defaultsKey]: Record<
    {
      [K in keyof Shape]: Shape[K]['hasDefault'] extends true ? K : never;
    }[keyof Shape],
    true
  >;
}

export class Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
  Relations extends Query['relations'] = Query['relations'],
> implements Query
{
  whereQueryBuilder = WhereQueryBuilder;
  onQueryBuilder = OnQueryBuilder;

  constructor(
    public adapter: Adapter,
    public queryBuilder: Db,
    public table: Table = undefined as Table,
    public shape: Shape = {} as Shape,
    options: DbTableOptions,
  ) {
    this.__model = this;

    const logger = options.logger || console;
    this.query = {
      adapter,
      handleResult: handleResult,
      returnType: 'all',
      logger,
      log: logParamToLogObject(logger, options.log),
    } as QueryData;

    if (options?.schema) {
      this.query.schema = options.schema;
    }

    this.schema = new TableSchema(shape);
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
    let modifyQuery: ((q: Query) => void)[] | undefined;
    for (const key in shape) {
      const column = shape[key];
      if (column.parseFn) {
        hasParsers = true;
        columnsParsers[key] = column.parseFn;
      }

      if (column.data.modifyQuery) {
        if (!modifyQuery) modifyQuery = [column.data.modifyQuery];
        else modifyQuery.push(column.data.modifyQuery);
      }
    }
    this.columnsParsers = hasParsers ? columnsParsers : undefined;

    this.toSql = defaultSelect
      ? function <T extends Query>(this: T, values?: unknown[]): Sql {
          const q = this.clone();
          if (!(q.query as SelectQueryData).select) {
            (q.query as SelectQueryData).select = defaultSelect as string[];
          }
          return toSql.call(q, values);
        }
      : toSql;

    this.relations = {} as Relations;

    modifyQuery?.forEach((cb) => cb(this));
  }
}

applyMixins(Db, [QueryMethods]);
Db.prototype.constructor = Db;

type DbResult<CT extends ColumnTypesBase> = Db & {
  <Table extends string, Shape extends ColumnsShape = ColumnsShape>(
    table: Table,
    shape?: ((t: CT) => Shape) | Shape,
    options?: DbTableOptions,
  ): Db<Table, Shape>;

  adapter: Adapter;
  close: Adapter['close'];
};

export type DbOptions<CT extends ColumnTypesBase = ColumnTypes> = (
  | { adapter: Adapter }
  | Omit<AdapterOptions, 'log'>
) &
  QueryLogOptions & {
    columnTypes?: CT;
  };

export const createDb = <CT extends ColumnTypesBase = ColumnTypes>({
  log,
  logger,
  columnTypes: ct = columnTypes as unknown as CT,
  ...options
}: DbOptions<CT>): DbResult<CT> => {
  const adapter = 'adapter' in options ? options.adapter : new Adapter(options);
  const commonOptions = { log, logger };

  const qb = new Db(
    adapter,
    undefined as unknown as Db,
    undefined,
    {},
    commonOptions,
  );
  qb.queryBuilder = qb;

  const db = Object.assign(
    <Table extends string, Shape extends ColumnsShape = ColumnsShape>(
      table: Table,
      shape?: ((t: CT) => Shape) | Shape,
      options?: DbTableOptions,
    ): Db<Table, Shape> => {
      return new Db<Table, Shape>(
        adapter,
        qb,
        table as Table,
        typeof shape === 'function' ? getColumnTypes(ct, shape) : shape,
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

  return db as DbResult<CT>;
};
