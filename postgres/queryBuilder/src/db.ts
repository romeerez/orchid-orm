import { AllColumns, DefaultSelectColumns, Query } from './query';
import { QueryMethods, QueryReturnType } from './queryMethods';
import { AggregateMethods } from './aggregateMethods';
import { QueryData } from './sql/types';
import { PostgresAdapter } from './adapter';
import {
  ColumnsShape,
  dataTypes,
  DataTypes,
  GetPrimaryKeys,
  GetPrimaryTypes,
  Output,
  tableSchema,
} from './schema';
import { applyMixins } from './utils';

export interface Db<
  Table extends string,
  Shape extends ColumnsShape = ColumnsShape,
> extends QueryMethods,
    AggregateMethods {
  new (adapter: PostgresAdapter): this;

  returnType: QueryReturnType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: QueryData<any>;
  shape: Shape;
  type: Output<Shape>;
  columns: (keyof Output<Shape>)[];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  result: AllColumns;
  table: Table;
  tableAlias: undefined;
  primaryKeys: GetPrimaryKeys<Shape>[];
  primaryTypes: GetPrimaryTypes<Shape, GetPrimaryKeys<Shape>>;
  windows: PropertyKey[];
  joinedTables: Query['joinedTables'];
  relations: Record<
    string,
    {
      key: string;
      type: string;
      query: Query;
      options: Record<string, unknown>;
      joinQuery: Query & { query: QueryData };
    }
  >;
}

export class Db<Table extends string, Shape extends ColumnsShape> {
  constructor(
    public adapter: PostgresAdapter,
    public table: Table,
    public shape: Shape,
  ) {
    const schemaObject = tableSchema(shape);
    const columns = Object.keys(shape) as unknown as (keyof Output<Shape>)[];
    const { toSql } = this;

    this.primaryKeys = schemaObject.getPrimaryKeys() as GetPrimaryKeys<Shape>[];
    this.columns = columns as (keyof Output<Shape>)[];
    this.defaultSelectColumns = columns.filter(
      (column) => !shape[column as keyof typeof shape].isHidden,
    ) as DefaultSelectColumns<Shape>;

    const defaultSelect =
      this.defaultSelectColumns.length === columns.length
        ? undefined
        : this.defaultSelectColumns;

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
  }

  returnType: QueryReturnType = 'all';
}

applyMixins(Db, [QueryMethods, AggregateMethods]);
Db.prototype.constructor = Db;

export const dbConstructor = (adapter: PostgresAdapter) => {
  return Object.assign(
    <Table extends string, Shape extends ColumnsShape = ColumnsShape>(
      table: Table,
      shape: (t: DataTypes) => Shape = () => ({} as Shape),
    ): Db<Table, Shape> => {
      return new Db<Table, Shape>(adapter, table, shape(dataTypes));
    },
    { adapter, destroy: () => adapter.destroy() },
  );
};
