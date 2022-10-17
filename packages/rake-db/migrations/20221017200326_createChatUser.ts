import { change } from '../src';

change(async (db) => {
  await db.createJoinTable(['chat', 'user'], (t) => ({
    ...t.timestamps(),
  }));
});
