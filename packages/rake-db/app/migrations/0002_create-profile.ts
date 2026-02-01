import { change } from '../dbScript';

change(async (db) => {
  await db.createTable('schema.profile', (t) => ({
    id: t.id(),
    profileKey: t.text().nullable(),
    userId: t.integer().foreignKey('schema.user', 'id').nullable(),
    bio: t.text().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));
});
