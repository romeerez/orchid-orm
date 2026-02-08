import { change } from '../db-script';

change(async (db) => {
  await db.createSchema('schema');
});

change(async (db) => {
  await db.createTable('schema.user', (t) => ({
    id: t.id(),
    userKey: t.text().nullable(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json().nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    deletedAt: t.timestamp().nullable(),
    ...t.timestamps(),
  }));
});
