import { AdapterBase } from './adapter';
import {
  ColumnShapeInput,
  ColumnShapeOutput,
  ColumnsShapeBase,
  ColumnTypesBase,
  DefaultSelectColumns,
  SinglePrimaryKey,
} from './columns/columnType';
import { QueryInternal } from './query';

export type DbBase<
  Adapter extends AdapterBase,
  Table extends string | undefined,
  Shape extends ColumnsShapeBase,
  CT extends ColumnTypesBase,
  Result extends ColumnsShapeBase = Pick<
    Shape,
    DefaultSelectColumns<Shape>[number]
  >,
> = {
  adapter: Adapter;
  table: Table;
  columns: (keyof Shape)[];
  columnTypes: CT;
  shape: Shape;
  singlePrimaryKey: SinglePrimaryKey<Shape>;
  type: ColumnShapeOutput<Shape>;
  inputType: ColumnShapeInput<Shape>;
  result: Result;
  internal: QueryInternal;
};
