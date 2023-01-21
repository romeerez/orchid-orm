import { change } from '../src';

change(async (db) => {
  await db.createJoinTable(['chat', 'user'], (t) => ({
    chatId: t.integer().foreignKey('chat', 'id'),
    userId: t.integer().foreignKey('user', 'id'),
    ...t.timestamps(),
    ...t.primaryKey(['chatId', 'userId']),
  }));
});
