import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('profile', (t) => ({
    id: t.id(),
    profileKey: t.text().nullable(),
    userId: t.integer().foreignKey('user', 'id').nullable(),
    bio: t.text().nullable(),
    ...t.timestamps(),
  }));
});
