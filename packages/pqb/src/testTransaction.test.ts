import { testDb, testingWithPostgresJS, useTestDatabase } from 'test-utils';
import { User, userData } from './test-utils/pqb.test-utils';
import { testTransaction } from './testTransaction';

describe('testTransaction', () => {
  describe('using test database', () => {
    useTestDatabase();

    it('should handle successful transactions', async () => {
      await expect(() =>
        testDb.transaction(async () => {
          await User.getOptional('id');
        }),
      ).resolves;
    });

    it('should handle failed transactions', async () => {
      await expect(() =>
        testDb.transaction(async () => {
          await User.get(User.sql`wrong`);
        }),
      ).rejects.toThrow(`column "wrong" does not exist`);
    });

    describe('nested describe', () => {
      useTestDatabase();

      beforeAll(async () => {
        await User.create(userData);
      });

      it('should have a user', async () => {
        expect(await User.count()).toBe(1);
      });

      it('should also have a user', async () => {
        expect(await User.count()).toBe(1);
      });
    });

    it('should have a clear state', async () => {
      expect(await User.count()).toBe(0);
    });
  });

  // Reopening a connection does not work with postgres-js
  if (!testingWithPostgresJS) {
    it('should support starting and closing multiple times', async () => {
      await testTransaction.start(testDb);
      await testTransaction.close(testDb);
      await testTransaction.start(testDb);
      await testTransaction.close(testDb);
    });
  }
});
