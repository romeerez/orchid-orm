import {
  ColumnsShape,
  dataTypes,
  DataTypes,
  GetPrimaryKeys,
  GetPrimaryTypes,
  Output,
  TableSchema,
  tableSchema,
} from '../queryBuilder/schema';
import { QueryMethods, QueryReturnType } from '../queryBuilder/queryMethods';
import { AggregateMethods } from '../queryBuilder/aggregateMethods';
import { QueryData } from '../queryBuilder/sql/types';
import { RelationMethods } from './relations/relations';
import { AllColumns, DefaultSelectColumns, Query } from '../queryBuilder/query';
import { PostgresAdapter } from '../queryBuilder/adapter';
import { applyMixins } from '../queryBuilder/utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface PostgresModel<S extends ColumnsShape, Table extends string>
  extends QueryMethods,
    AggregateMethods,
    RelationMethods {
  new (adapter: PostgresAdapter): this;

  returnType: QueryReturnType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: QueryData<any>;
  shape: S;
  type: Output<S>;
  columns: (keyof Output<S>)[];
  defaultSelectColumns: DefaultSelectColumns<S>;
  result: AllColumns;
  table: Table;
  tableAlias: undefined;
  schema: TableSchema<S>;
  primaryKeys: GetPrimaryKeys<S>[];
  primaryTypes: GetPrimaryTypes<S, GetPrimaryKeys<S>>;
  windows: PropertyKey[];
  joinedTables: Record<string, never>;
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

export class PostgresModel<S extends ColumnsShape, Table extends string> {
  constructor(public adapter: PostgresAdapter) {}

  returnType: QueryReturnType = 'all';
}

applyMixins(PostgresModel, [QueryMethods, AggregateMethods, RelationMethods]);
PostgresModel.prototype.constructor = PostgresModel;

type ModelParams<S extends ColumnsShape, Table extends string> = {
  table: Table;
  schema(t: DataTypes): S;
};

type ModelResult<S extends ColumnsShape, Table extends string> = {
  new (adapter: PostgresAdapter): InstanceType<PostgresModel<S, Table>>;
};

export const model = <S extends ColumnsShape, Table extends string>({
  table,
  schema,
}: ModelParams<S, Table>): ModelResult<S, Table> => {
  const shape = schema(dataTypes);
  const schemaObject = tableSchema(shape);
  const columns = Object.keys(shape) as unknown as (keyof Output<S>)[];
  const defaultSelectColumns = columns.filter(
    (column) => !shape[column as keyof typeof shape].isHidden,
  );
  const defaultSelect =
    defaultSelectColumns.length === columns.length
      ? undefined
      : defaultSelectColumns;

  const { toSql } = PostgresModel.prototype;

  return class extends PostgresModel<S, Table> {
    table = table;
    shape = shape;
    schema = schemaObject;
    primaryKeys = schemaObject.getPrimaryKeys() as any;
    columns = columns;
    defaultSelectColumns =
      defaultSelectColumns as unknown as DefaultSelectColumns<S>;

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
