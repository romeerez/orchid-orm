import { User } from '../test-utils/test-utils';
import { NotFoundError } from '../errors';
import { assertType, testDb, useTestDatabase } from 'test-utils';

describe('then', () => {
  useTestDatabase();
  afterAll(testDb.close);

  describe('catch', () => {
    it('should catch error', (done) => {
      const query = User.select({
        column: testDb.raw((t) => t.boolean(), 'koko'),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        expect(err.cause.stack).toContain('then.test.ts');
        done();
      });

      assertType<Awaited<typeof query>, { column: boolean }[] | void>();
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
});
