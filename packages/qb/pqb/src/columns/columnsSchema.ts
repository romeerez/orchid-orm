import { ColumnType } from './columnType';
import { ColumnsShapeBase, ColumnTypeBase } from 'orchid-core';
import { Operators } from './operators';

export type ColumnsShape = Record<string, ColumnType>;

export abstract class ColumnsObject<
  Shape extends ColumnsShapeBase,
> extends ColumnType<
  { [K in keyof Shape]: Shape[K]['type'] },
  typeof Operators.any,
  { [K in keyof Shape]: Shape[K]['inputType'] },
  { [K in keyof Shape]: Shape[K]['outputType'] },
  { [K in keyof Shape]: Shape[K]['queryType'] }
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
  typeof Operators.any,
  { [K in keyof Shape]: Shape[K]['inputType'] }[],
  { [K in keyof Shape]: Shape[K]['outputType'] }[],
  { [K in keyof Shape]: Shape[K]['queryType'] }[]
> {
  dataType = 'array' as const;
  operators = Operators.any;

  constructor(public shape: Shape) {
    super();
  }
}

export abstract class PluckResultColumnType<
  C extends ColumnTypeBase,
> extends ColumnTypeBase<
  C['type'][],
  typeof Operators.any,
  C['inputType'][],
  C['outputType'][],
  C['queryType'][]
> {}
