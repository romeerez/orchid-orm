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

  it('should be supported in whereExists', () => {
    expectSql(
      db.user.whereExists('profile').toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "user"."id"
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.user
        .whereExists('profile', (q) => q.where({ 'user.name': 'name' }))
        .toSql(),
      `
        SELECT "user".* FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."name" = $1
          LIMIT 1
        )
      `,
      ['name'],
    );
  });
});

// describe('hasOne through', () => {
//   it.only('should have method to query related data through belongsTo', async () => {
//     const profileQuery = db.profile.take();
//
//     const eq: AssertEqual<
//       typeof db.message.profile,
//       (params: { authorId: number }) => typeof profileQuery
//     > = true;
//
//     expect(eq).toBe(true);
//
//     // const query = db.message.profile({ authorId: 1 });
//
//     // console.log(query.toSql().text);
//
//     // expectSql(
//     //   query.toSql(),
//     //   `
//     //     SELECT "profile".* FROM "profile"
//     //     WHERE EXISTS (
//     //       SELECT 1 FROM "user"
//     //       WHERE "user"."profileId" = "profile"."id"
//     //         AND "user"."authorId" = $1
//     //       LIMIT $2
//     //     )
//     //     LIMIT $3
//     //   `,
//     //   [1, 1, 1],
//     // );
//   });
// });
