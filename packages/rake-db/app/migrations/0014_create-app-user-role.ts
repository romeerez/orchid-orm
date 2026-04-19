import { change } from '../db-script';

change(async (db) => {
  await db.createRole('app-user');
});
