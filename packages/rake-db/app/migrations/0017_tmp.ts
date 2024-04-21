import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('location', (t) => ({
    id: t.uuid().primaryKey(),
  }));
});

change(async (db) => {
  await db.createTable('location_link', (t) => ({
    id: t.uuid().primaryKey(),
    locationId: t.uuid().foreignKey('location', 'id'),
    url: t.varchar(),
  }));
});
