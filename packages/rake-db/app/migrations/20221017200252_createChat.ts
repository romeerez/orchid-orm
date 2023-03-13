import { change } from '../../src';

change(async (db) => {
  await db.createTable('chat', (t) => ({
    // a different id name to better test has and belongs to many
    idOfChat: t.serial().primaryKey(),
    title: t.text(),
    ...t.timestamps(),
  }));
});
