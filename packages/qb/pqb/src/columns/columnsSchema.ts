import { ColumnType } from './columnType';
import { Operators } from './operators';

export type ColumnsShape = Record<string, ColumnType>;

export abstract class ColumnsObject<
  Shape extends ColumnsShape,
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
  Shape extends ColumnsShape,
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
  C extends ColumnType,
> extends ColumnType<C['type'][], typeof Operators.any> {}
