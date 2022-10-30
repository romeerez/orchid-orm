import { adapter } from './test-utils';

describe('adapter', () => {
  it('should run query and close connection by calling .close()', async () => {
    const result = await adapter.query('SELECT 1 as num');
    expect(result.rows).toEqual([{ num: 1 }]);

    await adapter.close();
  });
});
