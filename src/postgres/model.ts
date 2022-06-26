import { PostgresAdapter } from './orm';
import { RelationThunks } from './relations';
import {
  ColumnsShape,
  dataTypes,
  DataTypes, GetPrimaryKeys, GetPrimaryTypes,
  TableSchema,
  tableSchema,
} from './schema';
import { QueryMethods } from './queryBuilder/queryMethods';
import { applyMixins } from './utils';
import { AggregateMethods } from './queryBuilder/aggregateMethods';
import { QueryData } from './queryBuilder/toSql';

export type Output<S extends ColumnsShape> = TableSchema<S>['output']

export type AllColumns = { __all: true }

export interface Query extends PostgresModel<ColumnsShape, string> {
  result: any
  then: any
}

export interface PostgresModel<S extends ColumnsShape, Table extends string>
  extends QueryMethods<S>, AggregateMethods {}

export class PostgresModel<S extends ColumnsShape, Table extends string> {
  constructor(public adapter: PostgresAdapter) {}

  shape!: S
  type!: Output<S>
  result!: AllColumns
  table!: Table
  schema!: TableSchema<S>
  primaryKeys!: any[]
  primaryTypes!: any[]
  query?: QueryData<any>
  returnType!: 'all'
}

applyMixins(PostgresModel, [QueryMethods, AggregateMethods])
PostgresModel.prototype.constructor = PostgresModel

export const model = <S extends ColumnsShape, Table extends string>({
  table,
  schema,
}: {
  table: Table
  schema(t: DataTypes): S,
}) => {
  const shape = schema(dataTypes)
  const schemaObject = tableSchema(shape)

  return class extends PostgresModel<S, Table> {
    table = table
    schema = schemaObject
    primaryKeys = schemaObject.getPrimaryKeys() as GetPrimaryKeys<S>
    primaryTypes!: GetPrimaryTypes<S, GetPrimaryKeys<S>>
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): Query;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
