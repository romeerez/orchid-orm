import { assertType, db, User, useTestDatabase } from '../test-utils';

describe('then', () => {
  useTestDatabase();

  describe('catch', () => {
    it('should catch error', (done) => {
      const query = User.select({
        column: db.raw((t) => t.boolean(), 'koko'),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        done();
      });

      assertType<Awaited<typeof query>, { column: boolean }[] | void>();
    });
  });
});
