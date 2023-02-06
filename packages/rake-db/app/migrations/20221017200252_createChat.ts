import { change } from '../../src';

change(async (db) => {
  await db.createTable('chat', (t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    ...t.timestamps(),
  }));
});
