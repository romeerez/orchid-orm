import { change } from '../db-config';

change(async (db) => {
  await db.createTable('schema.product', (t) => ({
    id: t.identity().primaryKey(),
    priceAmount: t.decimal(),
  }));
});
