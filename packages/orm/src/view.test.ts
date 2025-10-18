import { useTestORM } from './test-utils/orm.test-utils';
import { db, ProfileData, UserData } from 'test-utils';

describe('view', () => {
  useTestORM();

  it('should be queryable just as normal table', async () => {
    await db.user.createMany([
      {
        ...UserData,
        Active: false,
        profile: {
          create: ProfileData,
        },
      },
      {
        ...UserData,
        Active: true,
        profile: {
          create: ProfileData,
        },
      },
    ]);

    const count = await db.activeUserWithProfile.count();
    expect(count).toBe(1);
  });
});
