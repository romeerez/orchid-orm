import {
  ColumnsShape,
  dataTypes,
  DataTypes,
  Output,
  TableSchema,
  tableSchema,
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
} from 'pqb';
import { RelationMethods } from './relations/relations';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface PostgresModel<Shape extends ColumnsShape, Table extends string>
  extends QueryMethods,
    AggregateMethods,
    RelationMethods {
  new (adapter: PostgresAdapter): this;

  queryBuilder: Db;
  returnType: QueryReturnType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: QueryData<any>;
  shape: Shape;
  type: Output<Shape>;
  columns: (keyof Output<Shape>)[];
  defaultSelectColumns: DefaultSelectColumns<Shape>;
  result: Pick<Shape, DefaultSelectColumns<Shape>[number]>;
  hasSelect: false;
  selectable: Shape & {
    [K in keyof Shape as `${Table}.${StringKey<K>}`]: Shape[K];
  };
  table: Table;
  tableAlias: undefined;
  schema: TableSchema<Shape>;
  primaryKeys: string[];
  primaryTypes: unknown[];
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
  schema(t: DataTypes): Shape;
};

type ModelResult<Shape extends ColumnsShape, Table extends string> = {
  new (adapter: PostgresAdapter): InstanceType<PostgresModel<Shape, Table>>;
};

export const model = <Shape extends ColumnsShape, Table extends string>({
  table,
  schema,
}: ModelParams<Shape, Table>): ModelResult<Shape, Table> => {
  const shape = schema(dataTypes);
  const schemaObject = tableSchema(shape);
  const columns = Object.keys(shape) as unknown as (keyof Output<Shape>)[];
  const defaultSelectColumns = columns.filter(
    (column) => !shape[column as keyof typeof shape].isHidden,
  );
  const defaultSelect =
    defaultSelectColumns.length === columns.length
      ? undefined
      : defaultSelectColumns;

  const { toSql } = PostgresModel.prototype;

  return class extends PostgresModel<Shape, Table> {
    table = table;
    shape = shape;
    schema = schemaObject;
    primaryKeys = schemaObject.getPrimaryKeys() as any;
    columns = columns;
    defaultSelectColumns =
      defaultSelectColumns as unknown as DefaultSelectColumns<Shape>;

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

export type PostgresModelConstructor = new (
  adapter: PostgresAdapter,
) => InstanceType<PostgresModel<any, any>>;

export type PostgresModelConstructors = Record<
  string,
  PostgresModelConstructor
>;
