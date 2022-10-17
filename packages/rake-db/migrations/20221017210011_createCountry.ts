import { change } from '../src';

change(async (db) => {
  await db.createTable('geo.country', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }));
});
