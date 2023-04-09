import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('chat', (t) => ({
    // a different id name to better test has and belongs to many
    idOfChat: t.id(),
    title: t.text(),
    ...t.timestamps(),
  }));
});
