import { ColumnTypeBase, ColumnTypesBase, NullableColumn } from './columnType';

export interface ColumnSchemaGetterTableClass {
  prototype: { columns: ColumnTypesBase };
  inputSchema(): unknown;
  querySchema(): unknown;
}

export type ColumnSchemaGetterColumns<T extends ColumnSchemaGetterTableClass> =
  T['prototype']['columns'];

export interface ColumnTypeSchemaArg {
  type: unknown;
  nullable<T extends ColumnTypeBase>(
    this: T,
  ): NullableColumn<T, unknown, unknown, unknown>;
  encode: unknown;
  parse: unknown;
  asType: unknown;
  error?: unknown;
}

export interface ColumnSchemaConfig<T extends ColumnTypeBase = ColumnTypeBase>
  extends ColumnTypeSchemaArg {
  dateAsNumber: unknown;
  dateAsDate: unknown;
  enum: unknown;
  array: unknown;
  boolean(): unknown;
  buffer(): unknown;
  unknown(): unknown;
  never(): unknown;
  stringSchema(): unknown;
  stringMin(max: number): unknown;
  stringMax(max: number): unknown;
  stringMinMax(min: number, max: number): unknown;
  number(): unknown;
  int(): unknown;
  stringNumberDate(): unknown;
  timeInterval(): unknown;
  bit(max?: number): unknown;
  uuid(): unknown;
  json(): T;
  inputSchema(this: ColumnSchemaGetterTableClass): unknown;
  outputSchema(this: ColumnSchemaGetterTableClass): unknown;
  querySchema(this: ColumnSchemaGetterTableClass): unknown;
  updateSchema(this: ColumnSchemaGetterTableClass): unknown;
  pkeySchema(this: ColumnSchemaGetterTableClass): unknown;

  smallint(): T;
  integer(): T;
  real(): T;
  smallSerial(): T;
  serial(): T;

  bigint(): T;
  decimal(precision?: number, scale?: number): T;
  doublePrecision(): T;
  bigSerial(): T;
  money(): T;
  varchar(limit?: number): T;
  char(limit?: number): T;
  text(min: number, max: number): T;
  string(limit?: number): T;
  citext(min: number, max: number): T;

  date(): T;
  timestampNoTZ(precision?: number): T;
  timestamp(precision?: number): T;
}
