import 'dotenv/config';
import { Adapter } from './postgres/queryBuilder/src/adapter';
import { pgConfig } from './postgres/orm/src/test-utils/test-db';

module.exports = async () => {
  const db = Adapter(pgConfig);
  await db.query(`
    CREATE TABLE IF NOT EXISTS sample
    (
      id serial PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  const samplesQuery = await db.query('SELECT 1 FROM sample');
  if (samplesQuery.rows.length === 0) {
    await db.query(`
      INSERT INTO sample(id, name, description)
      VALUES (1, 'first', 'description'),
             (2, 'second', NULL)
    `);
  }

  await db.destroy();
};
