import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('schema.post', (t) => ({
    userId: t.integer().foreignKey('schema.user', 'id'),
  }));
});

change(async (db) => {
  await db.createTable('schema.tag', (t) => ({
    tag: t.text().primaryKey(),
  }));
});

change(async (db) => {
  await db.createTable(
    'schema.postTag',
    (t) => ({
      postId: t.integer().foreignKey('schema.post', 'id'),
      tag: t.text().foreignKey('schema.tag', 'tag'),
      active: t.boolean().nullable(),
    }),
    (t) => t.primaryKey(['postId', 'tag']),
  );
});
