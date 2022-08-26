import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertProfile,
  insertUser,
  useTestDatabase,
} from '../test-utils/test-utils';

describe('belongsTo', () => {
  useTestDatabase();

  it('should have method to query related data', async () => {
    const userQuery = db.user.take();

    const eq: AssertEqual<
      typeof db.profile.user,
      (params: { userId: number }) => typeof userQuery
    > = true;

    expect(eq).toBe(true);

    const userData = {
      id: 1,
      name: 'name',
      password: 'password',
      active: true,
    };
    const userId = await insertUser(userData);
    const profileId = await insertProfile({ userId });

    const profile = await db.profile.find(profileId).takeOrThrow();
    const query = db.profile.user(profile);

    expectSql(
      query.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = $1
        LIMIT $2
      `,
      [userId, 1],
    );

    const user = await query;

    expect(user).toMatchObject(userData);
  });
});
