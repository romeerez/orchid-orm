import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('tmp', (t) => ({
    id: t.identity().primaryKey(),
    data: t.array(t.decimal(10, 5)).nullable(),
  }));
});
