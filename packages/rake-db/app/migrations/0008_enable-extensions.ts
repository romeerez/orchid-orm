import { change } from '../db-config';

change(async (db) => {
  await db.createExtension('citext');
  await db.createExtension('postgis');
});
