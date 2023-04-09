import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('user', (t) => ({
    id: t.id(),
    name: t.text(),
    password: t.text(),
    picture: t.text().nullable(),
    data: t.json((t) => t.any()).nullable(),
    age: t.integer().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
