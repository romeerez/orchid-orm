import { ColumnType } from './columnType';
import { Operators } from '../columnsOperators';
import { Code, columnCode } from './code';

export class EnumColumn<
  U extends string = string,
  T extends [U, ...U[]] = [U],
> extends ColumnType<T[number], typeof Operators.any> {
  operators = Operators.any;
  dataType = 'enum';

  constructor(public enumName: string, public options: T) {
    super();
  }

  toCode(t: string): Code {
    return columnCode(
      this,
      t,
      `${t}.enum('${this.enumName}', [${this.options
        .map((option) => `'${option}'`)
        .join(', ')}])`,
    );
  }

  toSql() {
    return this.enumName;
  }
}
