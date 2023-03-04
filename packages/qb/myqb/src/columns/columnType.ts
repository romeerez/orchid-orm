import { BaseOperators, ColumnDataBase, ColumnTypeBase } from 'orchid-core';

export type ColumnData = ColumnDataBase;

export abstract class ColumnType<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
> extends ColumnTypeBase<Type, Ops, InputType, ColumnData> {}
