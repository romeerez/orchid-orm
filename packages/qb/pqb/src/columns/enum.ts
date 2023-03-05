import { ColumnType } from './columnType';
import { Operators } from './operators';
import { columnCode } from './code';
import { quoteFullColumn } from '../sql/common';
import { Code, ColumnTypesBase } from 'orchid-core';

export class EnumColumn<
  U extends string = string,
  T extends [U, ...U[]] = [U],
> extends ColumnType<T[number], typeof Operators.any> {
  operators = Operators.any;
  dataType = 'enum';

  constructor(
    types: ColumnTypesBase,
    public enumName: string,
    public options: T,
  ) {
    super(types);
  }

  toCode(t: string): Code {
    return columnCode(
      this,
      t,
      `enum('${this.enumName}', [${this.options
        .map((option) => `'${option}'`)
        .join(', ')}])`,
    );
  }

  toSQL() {
    return quoteFullColumn(this.enumName);
  }
}
