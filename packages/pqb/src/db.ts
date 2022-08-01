import {
  ColumnsParsers,
  DefaultSelectColumns,
  Query,
  QueryReturnType,
} from './query';
import { QueryMethods } from './queryMethods';
import { AggregateMethods } from './aggregateMethods';
import { QueryData } from './sql';
import { PostgresAdapter } from './adapter';
import {
  ColumnsShape,
  columnTypes,
  ColumnTypes,
  ColumnShapeOutput,
  TableSchema,
} from './columnSchema';
import { applyMixins } from './utils';
import { StringKey } from './common';

export type DbTableOptions = {
  schema?: string;
};

export interface Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
> extends QueryMethods,
    AggregateMethods {
  new (
    adapter: PostgresAdapter,
    queryBuilder: Db,
    table?: Table,
    shape?: Shape,
    options?: DbTableOptions,
  ): this;

  adapter: PostgresAdapter;
  queryBuilder: Db;
  table: Table;
  shape: Shape;
  schema: TableSchema<Shape>;
  type: ColumnShapeOutput<Shape>;
  returnType: QueryReturnType;
  query?: QueryData;
  columns: (keyof ColumnShapeOutput<Shape>)[];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  columnsParsers?: ColumnsParsers;
  result: Pick<Shape, DefaultSelectColumns<Shape>[number]>;
  hasSelect: false;
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
  relations: Query['relations'];
}

export class Db<
  Table extends string | undefined = undefined,
  Shape extends ColumnsShape = Record<string, never>,
> implements Query
{
  constructor(
    public adapter: PostgresAdapter,
    public queryBuilder: Db,
    public table: Table = undefined as Table,
    public shape: Shape = {} as Shape,
    options?: DbTableOptions,
  ) {
    if (options?.schema) {
      this.query = { schema: options.schema };
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

    const columnsParsers: ColumnsParsers = {};
    let hasParsers = false;
    for (const key in shape) {
      const column = shape[key];
      if (column.parseFn) {
        hasParsers = true;
        columnsParsers[key] = column.parseFn;
      }
    }
    this.columnsParsers = hasParsers ? columnsParsers : undefined;

    this.toSql = defaultSelect
      ? function <T extends Query>(this: T): string {
          const q = (this.query ? this : this.toQuery()) as T & {
            query: QueryData<T>;
          };
          if (!q.query.select) {
            q.query.select = defaultSelect as string[];
          }
          return toSql.call(q);
        }
      : toSql;

    this.relations = {};
  }

  returnType: QueryReturnType = 'all';
}

applyMixins(Db, [QueryMethods, AggregateMethods]);
Db.prototype.constructor = Db;

type DbResult = Db & {
  <Table extends string, Shape extends ColumnsShape>(
    table: Table,
    shape: ((t: ColumnTypes) => Shape) | Shape,
    options?: DbTableOptions,
  ): Db<Table, Shape>;

  adapter: PostgresAdapter;
  destroy: PostgresAdapter['destroy'];
};

export const createDb = (adapter: PostgresAdapter): DbResult => {
  const qb = new Db(adapter, undefined as unknown as Db);
  qb.queryBuilder = qb;

  return Object.assign(
    <Table extends string, Shape extends ColumnsShape>(
      table: Table,
      shape: ((t: ColumnTypes) => Shape) | Shape,
      options?: DbTableOptions,
    ): Db<Table, Shape> => {
      return new Db<Table, Shape>(
        adapter,
        qb,
        table as Table,
        typeof shape === 'function' ? shape(columnTypes) : shape,
        options,
      );
    },
    { ...qb, ...Db.prototype, adapter, destroy: () => adapter.destroy() },
  ) as DbResult;
};
