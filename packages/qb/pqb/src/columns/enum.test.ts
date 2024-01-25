import { assertType, testColumnTypes as t, testDb } from 'test-utils';

describe('enum column', () => {
  afterAll(testDb.close);

  beforeAll(async () => {
    await testDb.adapter.query(`
          DROP TYPE IF EXISTS mood
        `);
    await testDb.adapter.query(`
          CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
        `);
  });

  type MoodUnion = 'sad' | 'ok' | 'happy';

  it('should output proper union', async () => {
    const result = await testDb.get(
      testDb.sql`'happy'::mood`.type((t) =>
        t.enum('mood', ['sad', 'ok', 'happy']),
      ),
    );
    expect(result).toBe('happy');

    assertType<typeof result, MoodUnion>();
  });

  it('should have toCode', () => {
    expect(t.enum('mood', ['sad', 'ok', 'happy']).toCode('t')).toBe(
      `t.enum('mood', ['sad', 'ok', 'happy'])`,
    );
  });
});
