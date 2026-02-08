import { change } from '../mock-change';

change(async (db) => {
  await db.query`SELECT 'test query 1'`;
});
