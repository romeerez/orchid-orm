import { change } from '../dbScript';

change(async (db) => {
  await db.createTable(
    'chatUser',
    (t) => ({
      chatId: t.integer().foreignKey('chat', 'idOfChat'),
      userId: t.integer().foreignKey('user', 'id'),
      ...t.timestamps(),
    }),
    (t) => t.primaryKey(['chatId', 'userId']),
  );
});
