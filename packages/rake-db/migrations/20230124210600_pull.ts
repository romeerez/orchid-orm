import { change } from '../src';

change(async (db) => {
  await db.createSchema('geo');

  await db.createTable('chat', (t) => ({
    id: t.serial().primaryKey(),
    title: t.text(),
    ...t.timestamps(),
  }));

  await db.createTable('chatUser', (t) => ({
    chatId: t.integer().foreignKey('chat', 'id'),
    userId: t.integer().foreignKey('user', 'id'),
    ...t.timestamps(),
    ...t.primaryKey(['chatId', 'userId']),
  }));

  await db.createTable('geo.city', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    countryId: t.integer().foreignKey('country', 'id'),
  }));

  await db.createTable('geo.country', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
  }));

  await db.createTable('message', (t) => ({
    id: t.serial().primaryKey(),
    chatId: t.integer().foreignKey('chat', 'id').index({
      name: 'messageChatIdIndex',
    }),
    authorId: t.integer().foreignKey('user', 'id').nullable().index({
      name: 'messageAuthorIdIndex',
    }),
    text: t.text(),
    meta: t.json((t) => t.unknown()).nullable(),
    ...t.timestamps(),
  }));

  await db.createTable('profile', (t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer().foreignKey('user', 'id').nullable(),
    bio: t.text().nullable(),
    ...t.timestamps(),
  }));

  await db.createTable('uniqueTable', (t) => ({
    id: t.serial().primaryKey(),
    one: t.text().unique({
      name: 'uniqueTableOneIndex',
    }),
    two: t.integer().unique({
      name: 'uniqueTableTwoIndex',
    }),
    thirdColumn: t.text(),
    fourthColumn: t.integer(),
    ...t.index(
      [
        {
          column: 'thirdColumn',
        },
        {
          column: 'fourthColumn',
        },
      ],
      {
        name: 'uniqueTableThirdColumnFourthColumnIndex',
        unique: true,
      },
    ),
  }));

  await db.createTable('user', (t) => ({
    id: t.serial().primaryKey(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json((t) => t.unknown()).nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
