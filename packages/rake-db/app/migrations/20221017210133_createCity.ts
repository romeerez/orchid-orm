import { change } from '../../src';

change(async (db) => {
  await db.createTable('geo.city', (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    countryId: t.integer().foreignKey('geo.country', 'id'),
  }));
});
