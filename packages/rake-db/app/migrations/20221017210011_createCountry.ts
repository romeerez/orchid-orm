import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('geo.country', (t) => ({
    id: t.id(),
    name: t.text(),
  }));
});
