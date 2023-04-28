import { BaseTable } from '../baseTable';

export class SnakeTable extends BaseTable {
  readonly table = 'snake';
  columns = this.setColumns((t) => ({
    snakeId: t.name('snake_id').identity().primaryKey(),
    snake_name: t.text(0, Infinity),
    tailLength: t.name('tail_length').integer(),
    snakeData: t.name('snake_data').json((t) => t.any()).nullable(),
    ...t.timestamps(),
  }));
}
