import { ColumnType } from './columnType';
import { Operators } from './operators';
import { Code, singleQuote } from 'orchid-core';
import { columnCode } from './code';

// for a user-defined type, or for unsupported yet type from some module
export class CustomTypeColumn extends ColumnType<
  unknown,
  typeof Operators.any
> {
  operators = Operators.any;

  constructor(public dataType: string) {
    super();
    this.data.isOfCustomType = true;
  }

  toCode(t: string): Code {
    return columnCode(this, t, `type(${singleQuote(this.dataType)})`);
  }
}

// domain column type: https://www.postgresqltutorial.com/postgresql-tutorial/postgresql-user-defined-data-types/
export class DomainColumn extends CustomTypeColumn {
  toCode(t: string): Code {
    return columnCode(this, t, `domain(${singleQuote(this.dataType)})`);
  }
}
