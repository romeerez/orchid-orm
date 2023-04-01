import { change } from '../../src';

change(async (db) => {
  await db.createTable('profile', (t) => ({
    id: t.identity().primaryKey(),
    userId: t.integer().foreignKey('user', 'id').nullable(),
    bio: t.text().nullable(),
    ...t.timestamps(),
  }));
});
