import { NodePostgresAdapter } from 'pqb/node-postgres';
import { orchidORM } from './node-postgres';

describe('node-postgres', () => {
  it('should not pass `log` param to the driver', () => {
    const db = orchidORM(
      {
        databaseURL: 'postgres://user:@host:123/db?ssl=false',
        log: true,
      },
      {},
    );

    const adapter = db.$qb.adapter as NodePostgresAdapter;
    expect('log' in adapter.config).toBe(false);
  });
});
