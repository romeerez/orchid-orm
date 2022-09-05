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

  it('should have proper joinQuery', () => {
    expectSql(
      db.user.relations.profile.joinQuery.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE "profile"."userId" = "user"."id"
      `,
    );
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

  it('should be supported in join', () => {
    const query = db.user
      .join('profile', (q) => q.where({ 'user.name': 'name' }))
      .select('name', 'profile.bio');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { name: string; bio: string | null }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "user"."name", "profile"."bio" FROM "user"
        JOIN "profile"
          ON "profile"."userId" = "user"."id"
         AND "user"."name" = $1
      `,
      ['name'],
    );
  });
});

describe('hasOne through', () => {
  it('should have method to query related data', async () => {
    const profileQuery = db.profile.take();

    const eq: AssertEqual<
      typeof db.message.profile,
      (params: { authorId: number }) => typeof profileQuery
    > = true;

    expect(eq).toBe(true);

    const query = db.message.profile({ authorId: 1 });
    expectSql(
      query.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."id" = $1
          LIMIT 1
        )
        LIMIT $2
      `,
      [1, 1],
    );
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.message.relations.profile.joinQuery.toSql(),
      `
        SELECT "profile".* FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."id" = "message"."authorId"
          LIMIT 1
        )
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.message.whereExists('profile').toSql(),
      `
        SELECT "message".* FROM "message"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
            LIMIT 1
          )
          LIMIT 1
        )
      `,
    );

    expectSql(
      db.message
        .whereExists('profile', (q) => q.where({ 'message.text': 'text' }))
        .toSql(),
      `
        SELECT "message".* FROM "message"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
            LIMIT 1
          )
          AND "message"."text" = $1
          LIMIT 1
        )
      `,
      ['text'],
    );
  });

  it('should be supported in join', () => {
    const query = db.message
      .join('profile', (q) => q.where({ 'message.text': 'text' }))
      .select('text', 'profile.bio');

    const eq: AssertEqual<
      Awaited<typeof query>,
      { text: string; bio: string | null }[]
    > = true;
    expect(eq).toBe(true);

    expectSql(
      query.toSql(),
      `
        SELECT "message"."text", "profile"."bio" FROM "message"
        JOIN "profile"
          ON EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
            LIMIT 1
          )
          AND "message"."text" = $1
      `,
      ['text'],
    );
  });
});
