import {
  ColumnTypeBase,
  ColumnTypesBase,
  ErrorMessages,
  NullableColumn,
} from './columnType';
import { EmptyObject } from '../utils';

export type ColumnSchemaGetterTableClass = {
  prototype: { columns: ColumnTypesBase };
  inputSchema(): unknown;
  querySchema(): unknown;
};

export type ColumnSchemaGetterColumns<T extends ColumnSchemaGetterTableClass> =
  T['prototype']['columns'];

export interface ColumnSchemaConfig {
  type: unknown;
  parse: unknown;
  encode: unknown;
  asType: unknown;
  dateAsNumber: unknown;
  dateAsDate: unknown;
  dateMethods: EmptyObject;
  enum: unknown;
  array: unknown;
  boolean: unknown;
  buffer: unknown;
  unknown: unknown;
  never: unknown;
  string: unknown;
  stringMin(max: number): unknown;
  stringMax(max: number): unknown;
  stringMinMax(min: number, max: number): unknown;
  stringMethods: EmptyObject;
  number: unknown;
  int: unknown;
  numberMethods: EmptyObject;
  stringNumberDate: unknown;
  timeInterval: unknown;
  bit(max?: number): unknown;
  uuid: unknown;
  nullable<T extends ColumnTypeBase>(
    this: T,
  ): NullableColumn<T, unknown, unknown, unknown>;
  json(): ColumnTypeBase;
  inputSchema(this: ColumnSchemaGetterTableClass): unknown;
  outputSchema(this: ColumnSchemaGetterTableClass): unknown;
  querySchema(this: ColumnSchemaGetterTableClass): unknown;
  updateSchema(this: ColumnSchemaGetterTableClass): unknown;
  pkeySchema(this: ColumnSchemaGetterTableClass): unknown;
  errors?<T extends ColumnTypeBase>(this: T, errors: ErrorMessages): void;
}
