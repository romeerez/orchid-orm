import { BunSqlAdapter } from 'pqb/bun-sql';
import { describeIfBun } from 'test-utils/runtime';
import { orchidORM } from './bun-sql';

describeIfBun('bun-sql', () => {
  it('should not pass `log` param to the driver', () => {
    const db = orchidORM(
      {
        databaseURL: 'postgres://user:@host:123/db?ssl=false',
        log: true,
      },
      {},
    );

    const adapter = db.$qb.adapter as BunSqlAdapter;
    expect('log' in adapter.config).toBe(false);
  });
});
