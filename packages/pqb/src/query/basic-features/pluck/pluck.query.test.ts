import { User, userData } from '../../../test-utils/pqb.test-utils';
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
    await User.createMany(
      Array.from({ length: 3 }, () => ({ ...userData, createdAt: now })),
    );
  });

  it('should return array of column values, properly parsed', async () => {
    const result = await User.pluck('createdAt');

    expect(result).toEqual([now, now, now]);

    assertType<typeof result, Date[]>();
  });

  it('should support raw expression', async () => {
    const result = await User.pluck(testDb.sql`123`.type((t) => t.integer()));

    expect(result).toEqual([123, 123, 123]);

    assertType<typeof result, number[]>();
  });

  it('should support raw expression from a callback', async () => {
    const q = User.order('id').pluck((q) =>
      testDb.sql`coalesce(${q.ref('age')}, 20) + 1`.type((t) => t.integer()),
    );

    const result = await q;

    expect(result).toEqual([21, 21, 21]);

    assertType<typeof result, number[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT coalesce("user"."age", 20) + 1
        FROM "schema"."user"
        ORDER BY "user"."id" ASC
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
        FROM "schema"."user"
        LEFT JOIN LATERAL (
          SELECT "profile"."bio" "pluck"
          FROM "schema"."profile"
          WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
        ) "pluck" ON true
        WHERE "user"."name" = $1
      `,
      ['relation user'],
    );
  });
});
