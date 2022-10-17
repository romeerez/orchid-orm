import { change } from '../src';

change(async (db) => {
  await db.createTable('message', (t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer().foreignKey('chat', 'id').index(),
    authorId: t.integer().foreignKey('user', 'id').nullable().index(),
    text: t.text(),
    meta: t.json((t) => t.any()).nullable(),
    ...t.timestamps(),
  }));
});
