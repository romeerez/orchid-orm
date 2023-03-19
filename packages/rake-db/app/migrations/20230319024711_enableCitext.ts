import { change } from '../../src';

change(async (db) => {
  await db.createExtension('citext');
});
