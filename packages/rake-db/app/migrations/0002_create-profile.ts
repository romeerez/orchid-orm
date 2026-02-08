import { change } from '../db-script';

change(async (db) => {
  await db.createTable('schema.profile', (t) => ({
    id: t.id(),
    profileKey: t.text().nullable(),
    userId: t.integer().foreignKey('schema.user', 'id').nullable(),
    bio: t.text().nullable(),
    active: t.boolean().nullable(),
    ...t.timestamps(),
  }));

  await db.createTable('schema.profilePic', (t) => ({
    id: t.id(),
    profilePicKey: t.text(),
    profileId: t.integer().foreignKey('schema.profile', 'id').unique(),
    url: t.text(),
    ...t.timestamps(),
  }));
});
