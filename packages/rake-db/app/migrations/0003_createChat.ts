import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('chat', (t) => ({
    // a different id name to better test has and belongs to many
    idOfChat: t.id(),
    chatKey: t.text().nullable(),
    title: t.text(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
