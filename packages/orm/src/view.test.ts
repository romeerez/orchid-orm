import { useTestDatabase } from 'test-utils';
import { db, profileData, userData } from './test-utils/test-utils';

describe('view', () => {
  useTestDatabase();

  it('should be queryable just as normal table', async () => {
    await db.user.createMany([
      {
        ...userData,
        Active: false,
        profile: {
          create: profileData,
        },
      },
      {
        ...userData,
        Active: true,
        profile: {
          create: profileData,
        },
      },
    ]);

    const count = await db.activeUserWithProfile.count();
    expect(count).toBe(1);
  });
});
