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

export interface ColumnSchemaConfig extends ColumnTypeSchemaArg {
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
  json(): ColumnTypeBase;
  inputSchema(this: ColumnSchemaGetterTableClass): unknown;
  outputSchema(this: ColumnSchemaGetterTableClass): unknown;
  querySchema(this: ColumnSchemaGetterTableClass): unknown;
  updateSchema(this: ColumnSchemaGetterTableClass): unknown;
  pkeySchema(this: ColumnSchemaGetterTableClass): unknown;

  smallint(): ColumnTypeBase;
  integer(): ColumnTypeBase;
  real(): ColumnTypeBase;
  smallSerial(): ColumnTypeBase;
  serial(): ColumnTypeBase;

  bigint(): ColumnTypeBase;
  decimal(precision?: number, scale?: number): ColumnTypeBase;
  doublePrecision(): ColumnTypeBase;
  bigSerial(): ColumnTypeBase;
  money(): ColumnTypeBase;
  varchar(limit?: number): ColumnTypeBase;
  char(limit?: number): ColumnTypeBase;
  text(min: number, max: number): ColumnTypeBase;
  string(limit?: number): ColumnTypeBase;
  citext(min: number, max: number): ColumnTypeBase;

  date(): ColumnTypeBase;
  timestampNoTZ(precision?: number): ColumnTypeBase;
  timestamp(precision?: number): ColumnTypeBase;
}
