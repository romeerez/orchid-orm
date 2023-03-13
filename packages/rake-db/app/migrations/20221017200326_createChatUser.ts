import { change } from '../../src';

change(async (db) => {
  await db.createTable('chatUser', (t) => ({
    chatId: t.integer().foreignKey('chat', 'idOfChat'),
    userId: t.integer().foreignKey('user', 'id'),
    ...t.timestamps(),
    ...t.primaryKey(['chatId', 'userId']),
  }));
});
