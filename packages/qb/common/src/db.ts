import { AdapterBase } from './adapter';
import { ColumnsShapeBase } from './columns/columnType';

export type DbBase<
  Adapter extends AdapterBase,
  Table extends string | undefined,
  Shape extends ColumnsShapeBase = Record<string, never>,
> = {
  adapter: Adapter;
  table: Table;
  columns: (keyof Shape)[];
};
