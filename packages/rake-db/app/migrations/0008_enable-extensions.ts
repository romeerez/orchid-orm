import { change } from '../db-script';

change(async (db) => {
  await db.createExtension('citext');
  await db.createExtension('postgis');
});
