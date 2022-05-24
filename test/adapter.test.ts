import { createPg, SampleModel } from './utils';

describe('adapter', () => {
  it('should run query and close connection by calling .destroy()', async () => {
    const db = createPg({ model: SampleModel });
    const result = await db.model.adapter.query('SELECT 1 as num');
    expect(result.rows).toEqual([{ num: 1 }]);

    await db.destroy();
  });
});
