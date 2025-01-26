import { change } from '../dbScript';

change(async (db) => {
  await db.changeTable('user', (t) => ({
    deletedAt: t.timestamp().nullable(),
  }));
});
