import { change } from '../../src';

change(async (db) => {
  await db.createTable('geo.country', (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
  }));
});
