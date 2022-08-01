import { ColumnType } from './base';
import { Operators } from '../operators';

export class ArrayColumn<Item extends ColumnType> extends ColumnType<
  Item['type'][],
  typeof Operators.array
> {
  dataType = 'array' as const;
  data: { item: Item };

  constructor(item: Item) {
    super();

    this.data = { item };
  }

  toSQL() {
    return `${this.data.item.toSQL()}[]`;
  }
}
