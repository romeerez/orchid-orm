import { AdapterBase } from './adapter';
import {
  ColumnShapeInput,
  ColumnShapeOutput,
  QueryColumns,
  QueryColumnsInit,
  SinglePrimaryKey,
} from './columns/columnType';
import { QueryInternal } from './query';
import { RawSQLBase, TemplateLiteralArgs } from './raw';

// Argument for `query` and `queryArrays`, it can be a SQL template literal, or a raw SQL object.
export type SQLQueryArgs = TemplateLiteralArgs | [RawSQLBase];

export type DbBase<
  Adapter extends AdapterBase,
  Table extends string | undefined,
  Shape extends QueryColumnsInit,
  CT,
  ShapeWithComputed extends QueryColumns = Shape,
> = {
  adapter: Adapter;
  table: Table;
  columns: (keyof Shape)[];
  columnTypes: CT;
  shape: ShapeWithComputed;
  singlePrimaryKey: SinglePrimaryKey<Shape>;
  outputType: ColumnShapeOutput<Shape>;
  inputType: ColumnShapeInput<Shape>;
  internal: QueryInternal;
  query(...args: SQLQueryArgs): Promise<unknown>;
  queryArrays(...args: SQLQueryArgs): Promise<unknown>;
};
