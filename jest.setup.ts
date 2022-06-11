import 'dotenv/config'
import { pgConfig } from './src/postgres/test-utils';
import { Pg } from './src/postgres/pg.adapter';

module.exports = async () => {
  const db = Pg(pgConfig)
  await db.query(`
    CREATE TABLE IF NOT EXISTS sample
    (
      id serial PRIMARY KEY,
      name TEXT
    )
  `)

  const samplesQuery = await db.query('SELECT 1 FROM sample')
  if (samplesQuery.rows.length === 0) {
    await db.query(`
      INSERT INTO sample(id, name)
      VALUES (1, 'first'),
             (2, 'second')
    `)
  }

  await db.destroy()
}