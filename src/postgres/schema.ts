import { t } from 'tak'

type UnknownType = t.TakType<unknown>

type ColumnMethods = typeof columnMethods
const columnMethods = {
  isPrimaryKey: false,
  primaryKey<T extends UnknownType>(this: T): T & { isPrimaryKey: true } {
    return Object.assign(this, { isPrimaryKey: true as true })
  },
}

type Column<T extends UnknownType, D extends string> = T & ColumnMethods & {
  dataType: D
}

const column = <T extends UnknownType, D extends string>(type: T, dataType: D): Column<T, D> =>
  Object.assign(type, columnMethods, { dataType })

export type DataTypes = typeof dataTypes
export const dataTypes = {
  bigint: () => column(t.bigint(), 'bigint'),
  bigserial: () => column(t.bigint(), 'bigserial'),
  boolean: () => column(t.boolean(), 'boolean'),
  date: () => column(t.date(), 'date'),
  decimal: () => column(t.number(), 'decimal'),
  float: () => column(t.number(), 'float'),
  integer: () => column(t.number(), 'integer'),
  text: () => column(t.string(), 'text'),
  string: () => column(t.string(), 'text'),
  smallint: () => column(t.number(), 'smallint'),
  smallserial: () => column(t.number(), 'smallserial'),
  time: () => column(t.number(), 'time'),
  timestamp: () => column(t.number(), 'timestamp'),
  timestamptz: () => column(t.number(), 'timestamptz'),
  binary: () => column(t.string(), 'binary'),
  serial: () => column(t.number(), 'serial'),
}

export type ColumnsShape = Record<string, UnknownType & ColumnMethods>

type SchemaMethods = typeof schemaMethods

export type GetPrimaryKeys<Shape extends ColumnsShape> = UnionToArray<{ [K in keyof Shape]: Shape[K] extends { isPrimaryKey: true } ? K : never }[keyof Shape]>

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
