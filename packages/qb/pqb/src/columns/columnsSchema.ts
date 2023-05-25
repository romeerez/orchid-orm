import { ColumnType } from './columnType';
import { Operators } from './operators';
import { ColumnsShapeBase, ColumnTypeBase } from 'orchid-core';

export type ColumnsShape = Record<string, ColumnType>;

export abstract class ColumnsObject<
  Shape extends ColumnsShapeBase,
> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] },
  typeof Operators.any
> {
  dataType = 'object' as const;
  operators = Operators.any;

  constructor(public shape: Shape) {
    super();
  }
}

export abstract class ArrayOfColumnsObjects<
  Shape extends ColumnsShapeBase,
> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] }[],
  typeof Operators.any
> {
  dataType = 'array' as const;
  operators = Operators.any;

  constructor(public shape: Shape) {
    super();
  }
}

export abstract class PluckResultColumnType<
  C extends ColumnTypeBase,
> extends ColumnTypeBase<C['type'][], typeof Operators.any> {}
