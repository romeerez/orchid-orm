import { change } from '../db-config';

change(async (db) => {
  await db.createTable('schema.category', (t) => ({
    categoryName: t.text().primaryKey(),
    parentName: t.text().nullable(),
    ...t.timestamps(),
  }));
});
