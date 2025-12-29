import { PostgresJsAdapter } from 'pqb/postgres-js';
import { orchidORM } from './postgres-js';

describe('postgres-js', () => {
  it('should not pass `log` param to the driver', () => {
    const db = orchidORM(
      {
        databaseURL: 'postgres://user:@host:123/db?ssl=false',
        log: true,
      },
      {},
    );

    const adapter = db.$qb.adapter as PostgresJsAdapter;
    expect('log' in adapter.config).toBe(false);
  });
});
