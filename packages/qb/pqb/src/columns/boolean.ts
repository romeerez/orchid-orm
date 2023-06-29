import { ColumnType } from './columnType';
import { Operators } from './operators';
import { columnCode } from './code';
import { Code, NullableColumn } from 'orchid-core';

// 1 byte, true or false
export class BooleanColumn extends ColumnType<
  boolean,
  typeof Operators.boolean
> {
  static instance = new BooleanColumn();

  dataType = 'boolean' as const;
  operators = Operators.boolean;

  toCode(t: string): Code {
    return columnCode(this, t, 'boolean()');
  }

  parseItem = (input: string) => input[0] === 't';
}

export type BooleanNullable = NullableColumn<BooleanColumn>;
