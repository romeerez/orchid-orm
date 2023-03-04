import { ColumnType } from './columnType';
import { Operators } from './operators';
import { ColumnTypesBase } from '../../../common/src/columns/columnType';

export type ColumnsShape = Record<string, ColumnType>;

export abstract class ColumnsObject<
  Shape extends ColumnsShape,
> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] },
  typeof Operators.any
> {
  dataType = 'object' as const;
  operators = Operators.any;

  constructor(types: ColumnTypesBase, public shape: Shape) {
    super(types);
  }
}

export abstract class ArrayOfColumnsObjects<
  Shape extends ColumnsShape,
> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] }[],
  typeof Operators.any
> {
  dataType = 'array' as const;
  operators = Operators.any;

  constructor(types: ColumnTypesBase, public shape: Shape) {
    super(types);
  }
}

export abstract class PluckResultColumnType<
  C extends ColumnType,
> extends ColumnType<C['type'][], typeof Operators.any> {}
