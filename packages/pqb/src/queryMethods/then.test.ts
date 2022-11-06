import { assertType, UniqueTable, User, useTestDatabase } from '../test-utils';
import { raw } from '../common';
import { columnTypes } from '../columnSchema';
import { QueryError } from '../errors';

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

  describe('error handling', () => {
    it('should capture stack trace properly', async () => {
      let err: Error | undefined;

      await User.select({ column: raw(columnTypes.boolean(), 'koko') }).catch(
        (error) => (err = error),
      );

      expect(err?.stack).toContain('then.test.ts');
    });

    it('should have isUnique and column names map when violating unique error over single column', async () => {
      await UniqueTable.insert({
        one: 'one',
        two: 1,
        thirdColumn: 'three',
        fourthColumn: 1,
      });

      let err: QueryError | undefined;

      try {
        await UniqueTable.insert({
          one: 'one',
          two: 2,
          thirdColumn: 'three',
          fourthColumn: 2,
        });
      } catch (error) {
        if (error instanceof QueryError) {
          err = error;
        }
      }

      expect(err?.isUnique).toBe(true);
      expect(err?.columns).toEqual({
        one: true,
      });
    });

    it('should have isUnique and column names map when violating unique error over multiple columns', async () => {
      await UniqueTable.insert({
        one: 'one',
        two: 1,
        thirdColumn: 'three',
        fourthColumn: 1,
      });

      let err: QueryError | undefined;

      try {
        await UniqueTable.insert({
          one: 'two',
          two: 2,
          thirdColumn: 'three',
          fourthColumn: 1,
        });
      } catch (error) {
        if (error instanceof QueryError) {
          err = error;
        }
      }

      expect(err?.isUnique).toBe(true);
      expect(err?.columns).toEqual({
        thirdColumn: true,
        fourthColumn: true,
      });
    });
  });
});
