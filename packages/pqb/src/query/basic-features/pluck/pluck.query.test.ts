import {
  assertType,
  db,
  expectSql,
  now,
  ProfileData,
  testDb,
  useTestDatabase,
  UserData,
} from 'test-utils';

describe('pluck', () => {
  useTestDatabase();

  beforeEach(async () => {
    await db.user.createMany(
      Array.from({ length: 3 }, () => ({ ...UserData, createdAt: now })),
    );
  });

  it('should return array of column values, properly parsed', async () => {
    const result = await db.user.pluck('createdAt');

    expect(result).toEqual([now, now, now]);

    assertType<typeof result, Date[]>();
  });

  it('should support raw expression', async () => {
    const result = await db.user.pluck(
      testDb.sql`123`.type((t) => t.integer()),
    );

    expect(result).toEqual([123, 123, 123]);

    assertType<typeof result, number[]>();
  });

  it('should support raw expression from a callback', async () => {
    const q = db.user
      .order('Id')
      .pluck((q) =>
        testDb.sql`coalesce(${q.ref('Age')}, 20) + 1`.type((t) => t.integer()),
      );

    const result = await q;

    expect(result).toEqual([21, 21, 21]);

    assertType<typeof result, number[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT coalesce("User"."age", 20) + 1
        FROM "schema"."user" "User"
        ORDER BY "User"."id" ASC
      `,
    );
  });

  it('should support value query from a callback', async () => {
    await db.user.create({
      ...UserData,
      Name: 'relation user',
      profile: { create: ProfileData },
    });

    const q = db.user
      .where({ Name: 'relation user' })
      .pluck((q) => q.profile.get('Bio'));

    const result = await q;

    expect(result).toEqual([ProfileData.Bio]);

    assertType<typeof result, (string | null)[]>();
    // @ts-expect-error scalar callbacks only accept expressions or single-value queries
    db.user.pluck((q) => q.profile.select('Bio'));

    expectSql(
      q.toSQL(),
      `
        SELECT "pluck"."pluck" "pluck"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT array["profile"."bio"] "pluck"
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "User"."id" AND "profile"."profile_key" = "User"."user_key"
        ) "pluck" ON true
        WHERE "User"."name" = $1
      `,
      ['relation user'],
    );
  });

  it('should reset batch parsers after selecting a taken relation', async () => {
    const q = db.user.select({ posts: (q) => q.posts.take() });

    const result = await q.pluck('Id');

    expect(result).toHaveLength(3);
    expect(result.every((id) => typeof id === 'number')).toBe(true);
  });
});
