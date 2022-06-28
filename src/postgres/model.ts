import { PostgresAdapter } from './orm';
import { RelationThunks } from './relations';
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
import { SqlAdapter } from '../sql/sql.types';

export type Output<S extends ColumnsShape> = TableSchema<S>['output'];

export type AllColumns = { __all: true };

export interface Query extends PostgresModel<ColumnsShape, string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  returnType: QueryReturnType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tableAlias: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  joinedTables: any;
  defaultSelectColumns: DefaultSelectColumns<ColumnsShape>;
}

export type DefaultSelectColumns<S extends ColumnsShape> = {
  [K in keyof S]: S[K]['isHidden'] extends true ? never : K;
}[keyof S][];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface PostgresModel<S extends ColumnsShape, Table extends string>
  extends QueryMethods<S>,
    AggregateMethods {}

export class PostgresModel<S extends ColumnsShape, Table extends string> {
  constructor(public adapter: PostgresAdapter) {}

  returnType: QueryReturnType = 'all';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: QueryData<any>;
  shape!: S;
  type!: Output<S>;
  defaultSelectColumns!: DefaultSelectColumns<S>;
  result!: AllColumns;
  table!: Table;
  tableAlias!: undefined;
  schema!: TableSchema<S>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  primaryKeys!: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  primaryTypes!: any[];
  windows!: PropertyKey[];
  joinedTables!: Record<string, never>;
}

applyMixins(PostgresModel, [QueryMethods, AggregateMethods]);
PostgresModel.prototype.constructor = PostgresModel;

export const model = <S extends ColumnsShape, Table extends string>({
  table,
  schema,
}: {
  table: Table;
  schema(t: DataTypes): S;
}): new (adapter: SqlAdapter) => Omit<
  PostgresModel<S, Table>,
  'primaryKeys' | 'primaryTypes'
> & {
  primaryKeys: GetPrimaryKeys<S>;
  primaryTypes: GetPrimaryTypes<S, GetPrimaryKeys<S>>;
} => {
  const shape = schema(dataTypes);
  const schemaObject = tableSchema(shape);
  const allColumns = Object.keys(shape);
  const defaultSelectColumns = allColumns.filter(
    (column) => !shape[column].isHidden,
  );
  const defaultSelect =
    defaultSelectColumns.length === allColumns.length
      ? undefined
      : defaultSelectColumns;

  const { toSql } = PostgresModel.prototype;

  return class extends PostgresModel<S, Table> {
    table = table;
    schema = schemaObject;
    primaryKeys = schemaObject.getPrimaryKeys() as GetPrimaryKeys<S>;
    primaryTypes!: GetPrimaryTypes<S, GetPrimaryKeys<S>>;
    defaultSelectColumns =
      defaultSelectColumns as unknown as DefaultSelectColumns<S>;

    toSql = defaultSelect
      ? function <T extends Query>(this: T): string {
          const q = (this.query ? this : this.toQuery()) as T & {
            query: QueryData<T>;
          };
          if (!q.query.select) {
            q.query.select = defaultSelect;
          }
          return toSql.call(q);
        }
      : toSql;
  };
};

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): Query;

  relations?: RelationThunks;
};

export type PostgresModelConstructors = Record<
  string,
  PostgresModelConstructor
>;
