import { PostgresDialect, PostgresRepo } from '../src/dialects/postgres';
import { Pg } from '../src/adapters/pg';
import { pgConfig } from './utils';

class Repo extends PostgresRepo<{ id: number }> {}

describe('adapter', () => {
  it('should run query and close connection by calling .destroy()', async () => {
    const db = PostgresDialect(Pg(pgConfig))({
      repo: Repo,
    });
    const result = await db.repo.adapter.query('SELECT 1 as num');
    expect(result.rows).toEqual([{ num: 1 }]);

    await db.destroy();
  });
});
