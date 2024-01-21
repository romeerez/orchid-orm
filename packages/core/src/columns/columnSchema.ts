import {
  ColumnTypeBase,
  ColumnTypesBase,
  ErrorMessages,
  NullableColumn,
} from './columnType';
import { EmptyObject } from '../utils';

export type ColumnSchemaGetterTableClass = {
  prototype: { columns: ColumnTypesBase };
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
  stringMethods: EmptyObject;
  number: unknown;
  int: unknown;
  numberMethods: EmptyObject;
  stringNumberDate: unknown;
  timeInterval: unknown;
  bit: unknown;
  uuid: unknown;
  nullable<T extends ColumnTypeBase>(
    this: T,
  ): NullableColumn<T, unknown, unknown, unknown>;
  json(): ColumnTypeBase;
  inputSchema(this: ColumnSchemaGetterTableClass): unknown;
  outputSchema(this: ColumnSchemaGetterTableClass): unknown;
  querySchema(this: ColumnSchemaGetterTableClass): unknown;
  errors?<T extends ColumnTypeBase>(this: T, errors: ErrorMessages): void;
}
