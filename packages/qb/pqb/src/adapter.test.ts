import { asMock, testAdapter } from 'test-utils';
import { Adapter } from './adapter';
import pg from 'pg';
import { setTimeout } from 'timers/promises';

jest.mock('timers/promises', () => ({
  setTimeout: jest.fn(),
}));

describe('adapter', () => {
  it('should run query and close connection by calling .close()', async () => {
    const result = await testAdapter.query('SELECT 1 as num');
    expect(result.rows).toEqual([{ num: 1 }]);

    await testAdapter.close();
  });

  describe('connectRetry', () => {
    const err = Object.assign(new Error(), {
      code: 'ECONNREFUSED',
    });

    beforeAll(() => {
      pg.Pool.prototype.connect = () => {
        throw err;
      };
    });

    it('should handle default connect retry strategy', async () => {
      const adapter = new Adapter({
        connectRetry: true,
      });

      await expect(() => adapter.connect()).rejects.toThrow(err);

      const attempts = 10;
      const delay = 50;
      const factor = 1.5;
      expect(asMock(setTimeout).mock.calls).toEqual(
        Array.from({ length: attempts - 1 }).map((_, i) => [
          factor ** i * delay,
        ]),
      );
    });

    it('should use custom strategy', async () => {
      const strategy = jest.fn();

      const adapter = new Adapter({
        connectRetry: {
          attempts: 3,
          strategy,
        },
      });

      await expect(() => adapter.connect()).rejects.toThrow(err);

      expect(strategy.mock.calls).toEqual([
        [1, 3],
        [2, 3],
      ]);
    });
  });
});
