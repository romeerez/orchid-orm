import { BaseTable } from '../baseTable';

export class CityTable extends BaseTable {
  schema = 'geo';
  readonly table = 'city';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.text(0, Infinity),
    countryId: t.integer().foreignKey('geo.country', 'id'),
  }));
}
