import { PostgresAdapter } from './orm';
import {
  ColumnsShape,
  dataTypes,
  DataTypes,
  GetPrimaryKeys,
  GetPrimaryTypes,
  TableSchema,
  tableSchema,
} from './schema';
import { QueryMethods, QueryReturnType } from './queryBuilder/queryMethods';
import { applyMixins } from './utils';
import { AggregateMethods } from './queryBuilder/aggregateMethods';
import { QueryData } from './queryBuilder/toSql';
import {
  // ModelOrQuery,
  // Relation,
  RelationMethods,
  // RelationThunk,
  // RelationType,
} from './relations/relations';

export type Output<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['output'];
};

export type AllColumns = { __all: true };

export type Query = QueryMethods &
  AggregateMethods & {
    adapter: PostgresAdapter;
    query?: QueryData<any>;
    shape: ColumnsShape;
    schema: TableSchema<ColumnsShape>;
    type: Record<string, unknown>;
    result: any;
    returnType: QueryReturnType;
    then: any;
    table: string;
    tableAlias: string | undefined;
    joinedTables: any;
    windows: PropertyKey[];
    primaryKeys: any[];
    primaryTypes: any[];
    defaultSelectColumns: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    relations: any;
    // relations: Record<
    //   string,
    //   Relation<
    //     RelationThunk<RelationType, ModelOrQuery, Record<string, unknown>>
    //   >
    // >;
  };

export type DefaultSelectColumns<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['isHidden'] extends true ? never : K;
}[keyof S][];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface PostgresModel<S extends ColumnsShape, Table extends string>
  extends QueryMethods,
    AggregateMethods,
    RelationMethods {
  new (adapter: PostgresAdapter): this;
}

export class PostgresModel<S extends ColumnsShape, Table extends string> {
  constructor(public adapter: PostgresAdapter) {}

  returnType: QueryReturnType = 'all';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: QueryData<any>;
  shape!: S;
  type!: Output<S>;
  columns!: (keyof Output<S>)[];
  defaultSelectColumns!: DefaultSelectColumns<S>;
  result!: AllColumns;
  table!: Table;
  tableAlias!: undefined;
  schema!: TableSchema<S>;
  primaryKeys!: GetPrimaryKeys<S>[];
  primaryTypes!: GetPrimaryTypes<S, GetPrimaryKeys<S>>;
  windows!: PropertyKey[];
  joinedTables!: Record<string, never>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relations!: any;
  // relations!: Record<
  //   string,
  //   Relation<RelationThunk<RelationType, ModelOrQuery, Record<string, unknown>>>
  // >;
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
  } as any;
};

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): InstanceType<PostgresModel<any, any>>;
};

export type PostgresModelConstructors = Record<
  string,
  PostgresModelConstructor
>;
