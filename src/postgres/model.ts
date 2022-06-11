import { PostgresAdapter } from './orm';
import { RelationThunks } from './relations';
import { t } from 'tak'
import { dataTypes, DataTypes } from './schema';
import { toSql } from './toSql';

type QueryData = {
  select?: string[]
}

export class PostgresModel<Shape extends t.TakShape, T = t.TakObject<Shape>['output']> {
  constructor(public adapter: PostgresAdapter) {
  }

  table!: string
  schema!: t.TakObject<Shape>
  query = {} as QueryData

  all() {
    return this
  }

  clone(): this {
    const cloned = new (this.constructor as PostgresModelConstructor)(this.adapter)
    cloned.table = this.table
    cloned.schema = this.schema
    return cloned as this
  }

  then(
    resolve?: (value: T[]) => any,
    reject?: (error: any) => any,
  ): Promise<T[]> {
    return this.adapter.query<T>(toSql(this))
      .then(result => result.rows).then(resolve, reject)
  }

  select(...columns: (keyof T)[]) {
    return this.clone()._select(...columns)
  }

  _select(...columns: (keyof T)[]) {
    if (!this.query.select) this.query.select = columns as string[]
    else this.query.select.push(...columns as string[])
    return this
  }
}

export const model = <Shape extends t.TakShape>({
  table,
  schema,
}: {
  table: string
  schema(t: DataTypes): Shape,
}): { new (adapter: PostgresAdapter): PostgresModel<Shape> } => {
  const shape = schema(dataTypes)
  const schemaObject = t.object(shape)

  return class extends PostgresModel<Shape> {
    table = table
    schema = schemaObject
    columns = Object.keys(shape) as unknown as (keyof Shape)[]
  }
}

export type PostgresModelConstructor = {
  new (adapter: PostgresAdapter): PostgresModel<any>;

  relations?: RelationThunks;
}

export type PostgresModelConstructors = Record<string, PostgresModelConstructor>;
