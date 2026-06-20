import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('schema.profile', (t) => ({
    userIdNoFkey: t.integer().nullable(),
  }));

  await db.changeTable('schema.post', (t) => ({
    userIdNoFkey: t.integer().nullable(),
  }));

  await db.createTable('schema.user_task', (t) => ({
    userId: t.integer().primaryKey(),
    key: t.text().primaryKey(),
    taskId: t.integer().primaryKey(),
  }));
});

change(async (db) => {
  await db.createTable('schema.task', (t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().nullable(),
    taskKey: t.text().nullable(),
    title: t.text(),
    done: t.boolean().default(false),
  }));
});
