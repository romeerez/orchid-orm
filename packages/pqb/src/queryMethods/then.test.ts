import {
  assertType,
  db,
  User,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('then', () => {
  useTestDatabase();
  afterAll(db.close);

  describe('catch', () => {
    it('should catch error', (done) => {
      const query = User.select({
        column: db.raw((t) => t.boolean(), 'koko'),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        expect(err.stack).toContain('then.test.ts');
        done();
      });

      assertType<Awaited<typeof query>, { column: boolean }[] | void>();
    });
  });

  it('should throw NotFoundError with proper stack trace', async () => {
    let error: unknown | undefined;
    try {
      await User.take();
    } catch (err) {
      error = err;
    }

    expect((error as { stack: string }).stack).toContain('then.test.ts');
  });
});
