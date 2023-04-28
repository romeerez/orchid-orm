import { BaseTable } from '../baseTable';

export class CountryTable extends BaseTable {
  schema = 'geo';
  readonly table = 'country';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(0, Infinity),
  }));
}
