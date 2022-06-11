import { t } from 'tak'

const column = <T extends t.TakType<unknown>>(type: T, dataType: string): T & { dataType: string } =>
  Object.assign(type, { dataType })

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
