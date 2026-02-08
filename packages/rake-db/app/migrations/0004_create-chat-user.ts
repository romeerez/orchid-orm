import { change } from '../db-config';

change(async (db) => {
  await db.createTable(
    'schema.chatUser',
    (t) => ({
      userId: t.integer(),
      userKey: t.text(),
      chatId: t.integer(),
      chatKey: t.text(),
      ...t.timestamps(),
    }),
    (t) => [
      t.primaryKey(['userId', 'userKey', 'chatId', 'chatKey']),
      t.foreignKey(['userId'], 'schema.user', ['id']),
      t.foreignKey(['chatId'], 'schema.chat', ['idOfChat']),
    ],
  );
});
