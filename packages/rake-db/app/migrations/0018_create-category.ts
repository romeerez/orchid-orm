import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('category', (t) => ({
    categoryName: t.text().primaryKey(),
    parentName: t.text(),
    ...t.timestamps(),
  }));
});
