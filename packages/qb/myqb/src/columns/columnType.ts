import { BaseOperators } from '../../../common/src/columns/operators';
import {
  ColumnDataBase,
  ColumnTypeBase,
} from '../../../common/src/columns/columnType';

export type ColumnData = ColumnDataBase;

export abstract class ColumnType<
  Type = unknown,
  Ops extends BaseOperators = BaseOperators,
  InputType = Type,
> extends ColumnTypeBase<Type, Ops, InputType, ColumnData> {}
