import { ColumnType } from './columnType';
import { Operators } from '../operators';

export class BooleanColumn extends ColumnType<
  boolean,
  typeof Operators.boolean
> {
  dataType = 'boolean' as const;
  operators = Operators.boolean;
}
