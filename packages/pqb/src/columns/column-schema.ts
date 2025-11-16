import {
  ColumnTypeBase,
  ColumnTypesBase,
  NullableColumn,
} from '../core/columns/columnType';

export interface ColumnSchemaGetterTableClass {
  prototype: {
    columns: {
      shape: ColumnTypesBase;
    };
  };
  inputSchema(): unknown;
  querySchema(): unknown;
  pkeySchema(): unknown;
  createSchema(): unknown;
}

export type ColumnSchemaGetterColumns<T extends ColumnSchemaGetterTableClass> =
  T['prototype']['columns']['shape'];

export interface ColumnTypeSchemaArg {
  type: unknown;
  nullable<T extends ColumnTypeBase>(
    this: T,
  ): NullableColumn<T, unknown, unknown, unknown>;
  encode: unknown;
  parse: unknown;
  parseNull: unknown;
  asType: unknown;
  narrowType: unknown;
  narrowAllTypes: unknown;
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
  createSchema(this: ColumnSchemaGetterTableClass): unknown;
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
  text(): T;
  string(limit?: number): T;
  citext(): T;

  date(): T;
  timestampNoTZ(precision?: number): T;
  timestamp(precision?: number): T;

  geographyPointSchema(): unknown;
}
