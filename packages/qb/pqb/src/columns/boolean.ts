import { ColumnType } from './columnType';
import { Operators } from './operators';
import { columnCode } from './code';
import { Code } from '../../../common/src/columns/code';

// 1 byte, true or false
export class BooleanColumn extends ColumnType<
  boolean,
  typeof Operators.boolean
> {
  dataType = 'boolean' as const;
  operators = Operators.boolean;

  toCode(t: string): Code {
    return columnCode(this, t, `${t}.boolean()`);
  }

  parseItem = (input: string) => input[0] === 't';
}
