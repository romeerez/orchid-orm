import { db, User } from '../test-utils';
import { Client } from 'pg';

describe('transaction', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should start and commit transaction', async () => {
    const spy = jest.spyOn(Client.prototype, 'query');

    const result = await db.transaction(async (db) => {
      const {
        rows: [{ a }],
      } = await db.adapter.query('SELECT 1 AS a');
      const {
        rows: [{ b }],
      } = await db.adapter.query('SELECT 2 AS b');
      return a + b;
    });

    expect(result).toBe(3);

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual(['BEGIN', 'SELECT 1 AS a', 'SELECT 2 AS b', 'COMMIT']);
  });

  it('should rollback if error happens', async () => {
    const spy = jest.spyOn(Client.prototype, 'query');

    let error: Error | undefined;

    await db
      .transaction(async () => {
        throw new Error('error');
      })
      .catch((err) => (error = err));

    expect(error?.message).toBe('error');

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual(['BEGIN', 'ROLLBACK']);
  });

  describe('transacting', () => {
    it('should use provided adapter to perform queries', async () => {
      const spy = jest.spyOn(Client.prototype, 'query');

      await db.transaction(async (trx) => {
        return User.transacting(trx).all();
      });

      expect(
        spy.mock.calls.map(
          (call) => (call[0] as unknown as { text: string }).text,
        ),
      ).toEqual(['BEGIN', 'SELECT "user".* FROM "user"', 'COMMIT']);
    });
  });
});
