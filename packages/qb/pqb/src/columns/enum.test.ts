import { assertType, testZodColumnTypes as t, testDb } from 'test-utils';
import { ColumnToCodeCtx } from 'orchid-core';
import { defaultSchemaConfig, makeColumnTypes } from 'pqb';

const ctx: ColumnToCodeCtx = { t: 't', table: 'table' };

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
    const mood = ['sad', 'ok', 'happy'] as const;

    const result = await testDb.get(
      testDb.sql`'happy'::mood`.type((t) => t.enum('mood', mood)),
    );
    expect(result).toBe('happy');

    assertType<typeof result, MoodUnion>();
  });

  it('should have toCode', () => {
    expect(t.enum('mood', ['sad', 'ok', 'happy']).toCode(ctx, 'key')).toBe(
      `t.enum('mood', ['sad', 'ok', 'happy'])`,
    );
  });

  it('should have string literal union output and input type', () => {
    const t = makeColumnTypes(defaultSchemaConfig);
    const column = t.enum('mood', ['sad', 'ok', 'happy']);

    assertType<typeof column.outputType, 'sad' | 'ok' | 'happy'>();
    assertType<typeof column.inputType, 'sad' | 'ok' | 'happy'>();
  });
});
