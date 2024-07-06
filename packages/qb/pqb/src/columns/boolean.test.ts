import { assertType, testZodColumnTypes as t, testDb } from 'test-utils';

describe('boolean column', () => {
  afterAll(testDb.close);

  it('should output boolean', async () => {
    const result = await testDb.get(testDb.sql`true`.type((t) => t.boolean()));
    expect(result).toBe(true);

    assertType<typeof result, boolean>();
  });

  it('should have toCode', () => {
    const column = t.boolean();

    expect(column.toCode({ t: 't', table: 'table' }, 'key')).toBe(
      't.boolean()',
    );
  });
});
