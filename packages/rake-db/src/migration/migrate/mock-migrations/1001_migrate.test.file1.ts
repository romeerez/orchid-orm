import { change } from '../migrate.test';

export default change(async (db) => {
  await db.query`SELECT 'test query 1'`;
});
