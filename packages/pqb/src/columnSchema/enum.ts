import { ColumnType } from './columnType';
import { Operators } from '../columnsOperators';

export class EnumColumn<Type> extends ColumnType<Type, typeof Operators.any> {
  operators = Operators.any;

  constructor(public dataType: string) {
    super();
  }
}
