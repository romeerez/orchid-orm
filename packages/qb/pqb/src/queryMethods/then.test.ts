import { User } from '../test-utils/test-utils';
import { NotFoundError } from '../errors';
import { assertType, testDb, useTestDatabase } from 'test-utils';

describe('then', () => {
  useTestDatabase();
  afterAll(testDb.close);

  describe('catch', () => {
    it('should catch error', (done) => {
      const q = User.select({
        column: testDb.sql`koko`.type((t) => t.boolean()),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        expect(err.cause.stack).toContain('then.test.ts');
        done();
      });

      assertType<Awaited<typeof q>, { column: boolean }[] | void>();
    });
  });

  it('should throw NotFoundError with proper stack trace', async () => {
    let error: Error | undefined;
    try {
      await User.take();
    } catch (err) {
      error = err as Error;
    }

    expect(error instanceof NotFoundError).toBe(true);
    expect(((error as Error).cause as Error).stack).toContain('then.test.ts');
  });

  it('should handle .then callback properly', async () => {
    let isThenCalled = false;

    const len = await User.select('id').then((x) => {
      isThenCalled = true;
      return x.length;
    });

    assertType<typeof len, number>();

    expect(isThenCalled).toBe(true);
    expect(len).toBe(0);
  });
});
