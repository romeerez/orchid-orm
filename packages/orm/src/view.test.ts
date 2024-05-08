import {
  db,
  profileData,
  userData,
  useTestORM,
} from './test-utils/orm.test-utils';

describe('view', () => {
  useTestORM();

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
