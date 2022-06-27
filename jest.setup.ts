import 'dotenv/config'
import { Pg } from './src/postgres/pg.adapter';
import { pgConfig } from './src/postgres/test-utils/test-db';

module.exports = async () => {
  const db = Pg(pgConfig)
  await db.query(`
    CREATE TABLE IF NOT EXISTS sample
    (
      id serial PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )
  `)

  const samplesQuery = await db.query('SELECT 1 FROM sample')
  if (samplesQuery.rows.length === 0) {
    await db.query(`
      INSERT INTO sample(id, name, description)
      VALUES (1, 'first', 'description'),
             (2, 'second', NULL)
    `)
  }

  await db.destroy()
}