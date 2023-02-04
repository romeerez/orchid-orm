import { assertType, db } from '../test-utils/test-utils';
import { EnumColumn } from './enum';

describe('enum column', () => {
  afterAll(db.close);

  beforeAll(async () => {
    await db.adapter.query(`
          DROP TYPE IF EXISTS mood
        `);
    await db.adapter.query(`
          CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');
        `);
  });

  type MoodUnion = 'sad' | 'ok' | 'happy';

  it('should output proper union', async () => {
    const result = await db.get(
      db.raw(
        () => new EnumColumn('mood', ['sad', 'ok', 'happy']),
        `'happy'::mood`,
      ),
    );
    expect(result).toBe('happy');

    assertType<typeof result, MoodUnion>();
  });

  it('should have toCode', () => {
    expect(new EnumColumn('mood', ['sad', 'ok', 'happy']).toCode('t')).toBe(
      `t.enum('mood', ['sad', 'ok', 'happy'])`,
    );
  });
});
