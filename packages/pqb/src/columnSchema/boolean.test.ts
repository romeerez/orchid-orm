import { assertType, db } from '../test-utils/test-utils';
import { BooleanColumn } from './boolean';

describe('boolean column', () => {
  it('should output boolean', async () => {
    const result = await db.get(db.raw(() => new BooleanColumn(), `true`));
    expect(result).toBe(true);

    assertType<typeof result, boolean>();
  });
});
