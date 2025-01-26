import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('post', (t) => ({
    userId: t.integer().foreignKey('user', 'id'),
  }));
});

change(async (db) => {
  await db.createTable('tag', (t) => ({
    tag: t.text().primaryKey(),
  }));
});

change(async (db) => {
  await db.createTable(
    'postTag',
    (t) => ({
      postId: t.integer().foreignKey('post', 'id'),
      tag: t.text().foreignKey('tag', 'tag'),
    }),
    (t) => t.primaryKey(['postId', 'tag']),
  );
});
