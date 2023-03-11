import { ColumnType } from './columnType';
import { Operators } from './operators';
import { columnCode } from './code';
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
    const name = this.enumName;
    const index = name.indexOf('.');
    return `"${
      index === -1 ? name : `${name.slice(0, index)}"."${name.slice(index + 1)}`
    }"`;
  }
}
