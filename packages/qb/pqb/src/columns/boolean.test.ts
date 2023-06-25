import { BooleanColumn } from './boolean';
import { assertType, testDb } from 'test-utils';

describe('boolean column', () => {
  afterAll(testDb.close);

  it('should output boolean', async () => {
    const result = await testDb.get(
      testDb.sql`true`.type(() => new BooleanColumn()),
    );
    expect(result).toBe(true);

    assertType<typeof result, boolean>();
  });

  it('should have toCode', () => {
    const column = new BooleanColumn();

    expect(column.toCode('t')).toBe('t.boolean()');
  });
});
