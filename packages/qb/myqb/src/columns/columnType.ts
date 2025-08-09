import {
  ColumnDataBase,
  ColumnSchemaConfig,
  ColumnTypeBase,
} from 'orchid-core';

export type ColumnData = ColumnDataBase;

export abstract class ColumnType<
  Schema extends ColumnSchemaConfig = ColumnSchemaConfig,
  Type = unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InputSchema extends Schema['type'] = any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ops = any,
  InputType = Type,
  OutputType = Type,
  OutputSchema extends Schema['type'] = InputSchema,
  QueryType = InputType,
  QuerySchema extends Schema['type'] = InputSchema,
> extends ColumnTypeBase<
  Schema,
  Type,
  InputSchema,
  Ops,
  InputType,
  OutputType,
  OutputSchema,
  QueryType,
  QuerySchema,
  ColumnData
> {}
