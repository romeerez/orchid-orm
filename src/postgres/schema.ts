import { t } from 'tak'
import { Operators } from './operators';

type UnknownType = t.TakType<unknown>

type ColumnMethods<D extends string, Ops extends Operators> = {
  dataType: D,
  operators: Ops,
  isPrimaryKey: boolean
  primaryKey<T extends UnknownType>(this: T): T & { isPrimaryKey: true }
}

const columnMethods: Omit<ColumnMethods<any, any>, 'dataType' | 'operators'> = {
  isPrimaryKey: false,
  primaryKey<T extends UnknownType>(this: T): T & { isPrimaryKey: true } {
    return Object.assign(this, { isPrimaryKey: true as true })
  },
}

type Column<T extends UnknownType, D extends string, Ops extends Operators> =
  T & ColumnMethods<D, Ops>

const column = <T extends UnknownType, D extends string, Ops extends Operators>(
  type: T,
  dataType: D,
  operators: Ops,
): Column<T, D, Ops> => {
  return Object.assign(type, columnMethods, { dataType, operators })
}

export type DataTypes = typeof dataTypes
export const dataTypes = {
  bigint: () => column(t.bigint(), 'bigint', Operators.number),
  bigserial: () => column(t.bigint(), 'bigserial', Operators.number),
  boolean: () => column(t.boolean(), 'boolean', Operators.boolean),
  date: () => column(t.date(), 'date', Operators.date),
  decimal: () => column(t.number(), 'decimal', Operators.number),
  float: () => column(t.number(), 'float', Operators.number),
  integer: () => column(t.number(), 'integer', Operators.number),
  text: () => column(t.string(), 'text', Operators.text),
  string: () => column(t.string(), 'text', Operators.text),
  smallint: () => column(t.number(), 'smallint', Operators.number),
  smallserial: () => column(t.number(), 'smallserial', Operators.number),
  time: () => column(t.number(), 'time', Operators.time),
  timestamp: () => column(t.number(), 'timestamp', Operators.number),
  timestamptz: () => column(t.number(), 'timestamptz', Operators.number),
  binary: () => column(t.string(), 'binary', Operators.any),
  serial: () => column(t.number(), 'serial', Operators.number),
}

export type ColumnsShape = Record<string, UnknownType & ColumnMethods<any, any>>

type SchemaMethods = typeof schemaMethods

export type GetPrimaryKeys<Shape extends ColumnsShape> = UnionToArray<{ [K in keyof Shape]: Shape[K] extends { isPrimaryKey: true } ? K : never }[keyof Shape]>
export type GetPrimaryTypes<Shape extends ColumnsShape> = UnionToArray<{ [K in keyof Shape]: Shape[K] extends { isPrimaryKey: true } ? Shape[K]['output'] : never }[keyof Shape]>

const schemaMethods = {
  getPrimaryKeys<T extends t.TakObject<ColumnsShape>>(
    this: T
  ): GetPrimaryKeys<T['shape']> {
    return Object.entries(this.shape).filter(([_, column]) => {
      return column.isPrimaryKey
    }).map(([key]) => key) as any
  }
}

export type TableSchema<Shape extends ColumnsShape> = t.TakObject<Shape> & SchemaMethods

export const tableSchema = <Shape extends ColumnsShape>(
  shape: Shape
): TableSchema<Shape> => {
  return Object.assign(t.object(shape), schemaMethods)
}
