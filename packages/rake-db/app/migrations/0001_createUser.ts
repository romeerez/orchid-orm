import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('user', (t) => ({
    id: t.id(),
    userKey: t.text().nullable(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json().nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
