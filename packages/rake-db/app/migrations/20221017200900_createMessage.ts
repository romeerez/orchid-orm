import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('message', (t) => ({
    id: t.id(),
    chatId: t.integer().foreignKey('chat', 'idOfChat').index(),
    authorId: t.integer().foreignKey('user', 'id').nullable().index(),
    text: t.text(),
    meta: t.json().nullable(),
    ...t.timestamps(),
  }));
});
