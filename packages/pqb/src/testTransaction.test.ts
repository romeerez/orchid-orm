import { db, testDb, useTestDatabase, UserData } from 'test-utils';
import { testTransaction } from './testTransaction';

describe('testTransaction', () => {
  describe('using test database', () => {
    useTestDatabase();

    it('should handle successful transactions', async () => {
      await expect(() =>
        testDb.transaction(async () => {
          await db.user.getOptional('Id');
        }),
      ).resolves;
    });

    it('should handle failed transactions', async () => {
      await expect(() =>
        testDb.transaction(async () => {
          await db.user.get(db.user.sql`wrong`);
        }),
      ).rejects.toThrow(`column "wrong" does not exist`);
    });

    describe('nested describe', () => {
      useTestDatabase();

      beforeAll(async () => {
        await db.user.create(UserData);
      });

      it('should have a user', async () => {
        expect(await db.user.count()).toBe(1);
      });

      it('should also have a user', async () => {
        expect(await db.user.count()).toBe(1);
      });
    });

    it('should have a clear state', async () => {
      expect(await db.user.count()).toBe(0);
    });
  });

  it('should support starting and closing multiple times', async () => {
    await testTransaction.start(testDb);
    await testTransaction.close(testDb);
    await testTransaction.start(testDb);
    await testTransaction.close(testDb);
  });
});
