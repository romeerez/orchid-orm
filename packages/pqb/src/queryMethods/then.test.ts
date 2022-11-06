import { assertType, User, useTestDatabase } from '../test-utils';
import { raw } from '../common';
import { columnTypes } from '../columnSchema';

describe('then', () => {
  useTestDatabase();

  describe('catch', () => {
    it('should catch error', (done) => {
      const query = User.select({
        column: raw(columnTypes.boolean(), 'koko'),
      }).catch((err) => {
        expect(err.message).toBe(`column "koko" does not exist`);
        done();
      });

      assertType<Awaited<typeof query>, { column: boolean }[] | void>();
    });
  });
});
