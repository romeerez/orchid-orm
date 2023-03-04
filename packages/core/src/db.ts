import { AdapterBase } from './adapter';
import {
  ColumnShapeInput,
  ColumnShapeOutput,
  ColumnsShapeBase,
  ColumnTypesBase,
  DefaultSelectColumns,
  SinglePrimaryKey,
} from './columns/columnType';

export type DbBase<
  Adapter extends AdapterBase,
  Table extends string | undefined,
  Shape extends ColumnsShapeBase,
  CT extends ColumnTypesBase,
> = {
  adapter: Adapter;
  table: Table;
  columns: (keyof Shape)[];
  columnTypes: CT;
  shape: Shape;
  singlePrimaryKey: SinglePrimaryKey<Shape>;
  type: ColumnShapeOutput<Shape>;
  inputType: ColumnShapeInput<Shape>;
  result: Pick<Shape, DefaultSelectColumns<Shape>[number]>;
};
