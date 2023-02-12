import { AdapterBase } from './adapter';
import { ColumnShapeBase } from './columns/columnType';

export type DbBase<
  Adapter extends AdapterBase,
  Table extends string | undefined,
  Shape extends ColumnShapeBase = Record<string, never>,
> = {
  adapter: Adapter;
  table: Table;
  columns: (keyof Shape)[];
};
