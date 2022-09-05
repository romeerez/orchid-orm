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

  it('should have proper joinQuery', () => {
    expectSql(
      db.profile.relations.user.joinQuery.toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE "user"."id" = "profile"."userId"
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.profile.whereExists('user').toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "user"."id" = "profile"."userId"
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.profile
        .whereExists('user', (q) => q.where({ 'user.name': 'name' }))
        .toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "user"."id" = "profile"."userId"
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
      ['name'],
    );
  });

  it('should be supported in join', () => {
    const query = db.profile
      .join('user', (q) => q.where({ 'user.name': 'name' }))
      .select('bio', 'user.name');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { bio: string | null; name: string }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "profile"."bio", "user"."name" FROM "profile"
        JOIN "user" ON "user"."id" = "profile"."userId" AND "user"."name" = $1
      `,
      ['name'],
    );
  });
});
