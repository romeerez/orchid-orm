import { ColumnType } from './columnType';
import { Operators } from '../operators';

export class EnumColumn<DataType extends string, Type> extends ColumnType<
  Type,
  typeof Operators.any
> {
  operators = Operators.any;

  constructor(public dataType: DataType) {
    super();
  }
}
