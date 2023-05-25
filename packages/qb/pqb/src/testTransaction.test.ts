import { testDb, useTestDatabase } from 'test-utils';
import { User, userData } from './test-utils/test-utils';

describe('testTransaction', () => {
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
