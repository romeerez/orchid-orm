import { db, expectSql, testAdapter } from 'test-utils';
import { createDbWithAdapter } from '../../db';
import { noop } from '../../../utils';

describe('storage', () => {
  afterAll(db.$close);

  it('should override log option', async () => {
    const q = db.user.log(false);

    const spy = jest.spyOn(q.q.logger, 'log').mockImplementation(noop);

    await q.withOptions({ log: true }, async () => {
      await q;
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('should set default schema', async () => {
    const db = createDbWithAdapter({
      adapter: testAdapter,
    });

    const table = db('table', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const sql = await table.withOptions({ schema: 'from-options' }, async () =>
      table.toSQL(),
    );

    expectSql(sql, `SELECT * FROM "from-options"."table"`);
  });
});
