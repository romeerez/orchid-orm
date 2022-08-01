import { ColumnType } from './base';
import { Operators } from '../operators';

export class EnumColumn<DataType extends string, Type> extends ColumnType<
  Type,
  typeof Operators.any
> {
  constructor(public dataType: DataType) {
    super();
  }
}
