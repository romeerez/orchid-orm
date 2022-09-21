import { ColumnType } from './columnType';
import { Operators } from '../columnsOperators';

// 1 byte, true or false
export class BooleanColumn extends ColumnType<
  boolean,
  typeof Operators.boolean
> {
  dataType = 'boolean' as const;
  operators = Operators.boolean;

  parseItem = (input: string) => input[0] === 't';
}
