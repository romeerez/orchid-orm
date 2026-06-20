import { change } from '../db-script';

change(async (db) => {
  await db.changeTable('schema.user', (t) => ({
    balance: t.decimal().nullable(),
  }));
});
