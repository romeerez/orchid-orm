import { ColumnType } from './columnType';
import { columnCode } from './code';
import { Code } from 'orchid-core';
import { Operators } from './operators';

export class EnumColumn<
  U extends string = string,
  T extends [U, ...U[]] = [U],
> extends ColumnType<T[number], typeof Operators.any> {
  operators = Operators.any;
  dataType = 'enum';

  constructor(public enumName: string, public options: T) {
    super();
  }

  toCode(t: string, migration?: boolean): Code {
    const options = migration
      ? ''
      : `, [${this.options.map((option) => `'${option}'`).join(', ')}]`;
    return columnCode(this, t, `enum('${this.enumName}'${options})`);
  }

  toSQL() {
    const name = this.enumName;
    const index = name.indexOf('.');
    return `"${
      index === -1 ? name : `${name.slice(0, index)}"."${name.slice(index + 1)}`
    }"`;
  }
}
