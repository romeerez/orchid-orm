import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.product', (t) => ({
    id: t.identity().primaryKey(),
    priceAmount: t.decimal(),
  }));
});
