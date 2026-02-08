import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.chat', (t) => ({
    // a different id name to better test has and belongs to many
    idOfChat: t.id(),
    chatKey: t.text().nullable(),
    title: t.text(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
