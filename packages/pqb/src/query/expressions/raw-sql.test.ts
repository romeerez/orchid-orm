import { sql } from 'test-utils';

describe('raw sql', () => {
  it('should support unsafe expressions', () => {
    const res = sql`value = ${sql.unsafe(123)}`;
    const values: unknown[] = [];

    expect(res.makeSQL({ values })).toBe('value = 123');
    expect(values).toEqual([]);
  });
});
