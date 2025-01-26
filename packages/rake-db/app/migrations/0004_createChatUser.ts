import { change } from '../dbScript';

change(async (db) => {
  await db.createTable(
    'chatUser',
    (t) => ({
      userId: t.integer(),
      userKey: t.text(),
      chatId: t.integer(),
      chatKey: t.text(),
      ...t.timestamps(),
    }),
    (t) => [
      t.primaryKey(['userId', 'userKey', 'chatId', 'chatKey']),
      t.foreignKey(['userId'], 'user', ['id']),
      t.foreignKey(['chatId'], 'chat', ['idOfChat']),
    ],
  );
});
