import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.category', (t) => ({
    categoryName: t.text().primaryKey(),
    parentName: t.text().nullable(),
    ...t.timestamps(),
  }));
});
