import { PostgresAdapter } from './orm';
import { RelationThunks } from './relations';
import {
  ColumnsShape,
  dataTypes,
  DataTypes,
  GetPrimaryKeys,
  TableSchema,
  tableSchema,
} from './schema';
import { QueryData, QueryMethods } from './queryBuilder/queryMethods';
import { applyMixins } from './utils';
import { AggregateMethods } from './queryBuilder/aggregateMethods';

export type Base = Omit<PostgresModel, 'result' | 'then'> & { result: any, then: any }

export type Output<S extends ColumnsShape> = TableSchema<S>['output']

export type AllColumns = { __all: true }

export interface PostgresModel<S extends ColumnsShape = any, Table extends string = any>
  extends QueryMethods<S>, AggregateMethods {}

export class PostgresModel<S extends ColumnsShape = any, Table extends string = any> {
  constructor(public adapter: PostgresAdapter) {}

  type!: Output<S>
  result!: AllColumns
  table!: Table
  schema!: TableSchema<S>
  primaryKeys!: GetPrimaryKeys<S>
  query?: QueryData
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
}): { new (adapter: PostgresAdapter): PostgresModel<S, Table> } => {
  const shape = schema(dataTypes)
  const schemaObject = tableSchema(shape)

  return class extends PostgresModel<S, Table> {
    table = table
    schema = schemaObject
    primaryKeys = schemaObject.getPrimaryKeys()
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): PostgresModel;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
