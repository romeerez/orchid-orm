import { BaseTable } from '../baseTable';

export class UniqueTableTable extends BaseTable {
  readonly table = 'uniqueTable';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    one: t.text(0, Infinity).unique(),
    two: t.integer().unique(),
    thirdColumn: t.text(0, Infinity),
    fourthColumn: t.integer(),
    ...t.index(['thirdColumn', 'fourthColumn'], {
      unique: true,
    }),
  }));
}
