import { db } from '../test-utils/test-utils';
import pg from 'pg';

describe('transaction', () => {
  beforeEach(() => jest.clearAllMocks());
  afterAll(db.close);

  it('should start and commit transaction', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    const result = await db.transaction(async () => {
      const {
        rows: [{ a }],
      } = await db.query.adapter.query('SELECT 1 AS a');
      const {
        rows: [{ b }],
      } = await db.query.adapter.query('SELECT 2 AS b');
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
    const spy = jest.spyOn(pg.Client.prototype, 'query');

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

  it('should accept isolation level and options', async () => {
    const spy = jest.spyOn(pg.Client.prototype, 'query');

    await db.transaction('REPEATABLE READ', async () => {});
    await db.transaction(
      {
        level: 'READ COMMITTED',
        readOnly: false,
        deferrable: false,
      },
      async () => {},
    );
    await db.transaction(
      {
        level: 'READ UNCOMMITTED',
        readOnly: true,
        deferrable: true,
      },
      async () => {},
    );

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN ISOLATION LEVEL REPEATABLE READ',
      'COMMIT',
      'BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE NOT DEFERRABLE',
      'COMMIT',
      'BEGIN ISOLATION LEVEL READ UNCOMMITTED READ ONLY DEFERRABLE',
      'COMMIT',
    ]);
  });
});
