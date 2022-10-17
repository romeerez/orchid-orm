import { change } from '../src';

change(async (db) => {
  await db.createSchema('geo');
});
