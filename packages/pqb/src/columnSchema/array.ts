import { ColumnType } from './columnType';
import { Operators } from '../operators';

export class ArrayColumn<Item extends ColumnType> extends ColumnType<
  Item['type'][],
  typeof Operators.array
> {
  dataType = 'array' as const;
  operators = Operators.array;
  data: { item: Item };

  constructor(item: Item) {
    super();

    this.data = { item };
  }

  toSQL() {
    return `${this.data.item.toSQL()}[]`;
  }
}
