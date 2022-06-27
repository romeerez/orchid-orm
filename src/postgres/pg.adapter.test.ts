import { createPg } from './test-utils/test-db';
import { User } from './test-utils/test-models';

describe('adapter', () => {
  it('should run query and close connection by calling .destroy()', async () => {
    const db = createPg({ model: User });
    const result = await db.model.adapter.query('SELECT 1 as num');
    expect(result.rows).toEqual([{ num: 1 }]);

    await db.destroy();
  });
});
