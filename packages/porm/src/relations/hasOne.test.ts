import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertProfile,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('hasOne', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const profileQuery = db.profile.take();

    const eq: AssertEqual<
      typeof db.user.profile,
      (params: { id: number }) => typeof profileQuery
    > = true;

    expect(eq).toBe(true);

    const userId = await insertUser();

    const profileData = {
      id: 1,
      userId,
      bio: 'text',
    };
    await insertProfile(profileData);

    const user = await db.user.find(userId).takeOrThrow();
    const query = db.user.profile(user);

    expectSql(
      query.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE "profile"."userId" = $1
        LIMIT $2
      `,
      [userId, 1],
    );

    const profile = await query;

    expect(profile).toMatchObject(profileData);
  });
});
