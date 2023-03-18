import { ColumnType } from './columnType';
import { Operators } from './operators';
import { Code, ColumnTypesBase, singleQuote } from 'orchid-core';
import { columnCode } from './code';

// domain column type: https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/
export class DomainColumn extends ColumnType<unknown, typeof Operators.any> {
  operators = Operators.any;

  constructor(types: ColumnTypesBase, public dataType: string) {
    super(types);
    this.data.isOfCustomType = true;
  }

  toCode(t: string): Code {
    return columnCode(this, t, `domain(${singleQuote(this.dataType)})`);
  }
}
