import { ColumnType } from './columnType';
import { Operators } from '../columnsOperators';

export class EnumColumn<
  U extends string,
  T extends [U, ...U[]],
> extends ColumnType<T[number], typeof Operators.any> {
  operators = Operators.any;
  dataType = 'enum';

  constructor(public enumName: string, public options: T) {
    super();
  }

  toSql() {
    return this.enumName;
  }
}
