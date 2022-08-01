import {
  ColumnsShape,
  columnTypes,
  ColumnTypes,
  TableSchema,
  QueryMethods,
  AggregateMethods,
  QueryData,
  DefaultSelectColumns,
  Query,
  QueryReturnType,
  PostgresAdapter,
  applyMixins,
  StringKey,
  Db,
  DbTableOptions,
  ColumnShapeOutput,
  ColumnsParsers,
} from 'pqb';
import { RelationMethods } from './relations/relations';

export interface PostgresModel<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Shape extends ColumnsShape = any,
  Table extends string = string,
> extends QueryMethods,
    AggregateMethods,
    RelationMethods {
  new (adapter: PostgresAdapter): this;

  queryBuilder: Db;
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
  table: Table;
  tableAlias: undefined;
  windows: PropertyKey[];
  withData: Query['withData'];
  joinedTables: Query['joinedTables'];
  relations: Query['relations'];
}

export class PostgresModel<Shape extends ColumnsShape, Table extends string> {
  constructor(public adapter: PostgresAdapter) {}

  returnType: QueryReturnType = 'all';
}

applyMixins(PostgresModel, [QueryMethods, AggregateMethods, RelationMethods]);
PostgresModel.prototype.constructor = PostgresModel;

type ModelParams<Shape extends ColumnsShape, Table extends string> = {
  table: Table;
  schema(t: ColumnTypes): Shape;
  options?: DbTableOptions;
};

export type ModelClass<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Shape extends ColumnsShape = any,
  Table extends string = string,
> = {
  new (adapter: PostgresAdapter): PostgresModel<Shape, Table>;
};

export const model = <Shape extends ColumnsShape, Table extends string>({
  table,
  schema: schemaFn,
  options,
}: ModelParams<Shape, Table>): ModelClass<Shape, Table> => {
  const shape = schemaFn(columnTypes);
  const schema = new TableSchema(shape);
  const columns = Object.keys(
    shape,
  ) as unknown as (keyof ColumnShapeOutput<Shape>)[];
  const defaultSelectColumns = columns.filter(
    (column) => !shape[column as keyof typeof shape].isHidden,
  );
  const defaultSelect =
    defaultSelectColumns.length === columns.length
      ? undefined
      : defaultSelectColumns;

  const columnsParsers: ColumnsParsers = {};
  let hasParsers = false;
  for (const key in shape) {
    const column = shape[key];
    if (column.parseFn) {
      hasParsers = true;
      columnsParsers[key] = column.parseFn;
    }
  }

  const { toSql } = PostgresModel.prototype;

  return class extends PostgresModel<Shape, Table> {
    table = table;
    shape = shape;
    schema = schema;
    columns = columns;
    defaultSelectColumns =
      defaultSelectColumns as unknown as DefaultSelectColumns<Shape>;

    columnsParsers = hasParsers ? columnsParsers : undefined;

    query = options?.schema ? { schema: options.schema } : undefined;

    toSql = defaultSelect
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
  };
};

export type PostgresModelConstructors = Record<string, ModelClass>;
