import { change } from '../src';

change(async (db) => {
  await db.createTable('profile', (t) => ({
    id: t.serial().primaryKey(),
    userId: t.integer().foreignKey('user', 'id').nullable(),
    bio: t.text().nullable(),
    ...t.timestamps(),
  }));
});
