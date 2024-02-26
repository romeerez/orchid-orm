import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('geo.city', (t) => ({
    id: t.id(),
    name: t.text(),
    countryId: t.integer().foreignKey('geo.country', 'id'),
  }));
});
