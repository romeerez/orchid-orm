import {
  assertType,
  db,
  expectSql,
  UserData,
  useTestDatabase,
} from 'test-utils';

describe('exists methods', () => {
  useTestDatabase();

  describe('exists', () => {
    it('should discard previous select, select 1 and transform to boolean', async () => {
      const q = db.user.select('Id').exists();

      assertType<Awaited<typeof q>, boolean>();

      expect(await q).toBe(false);

      await db.user.insert(UserData);

      expect(await q).toBe(true);

      expectSql(q.toSQL(), 'SELECT true FROM "schema"."user" LIMIT 1');
    });

    it('should coalesce value in sub-select', async () => {
      const q = db.user.select({
        hasProfile: (q) => q.profile.exists(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("hasProfile"."hasProfile", false) "hasProfile"
          FROM "schema"."user"
          LEFT JOIN LATERAL (
            SELECT true "hasProfile"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id"
              AND "profile"."profile_key" = "user"."user_key"
          ) "hasProfile" ON true
        `,
      );
    });
  });

  describe('not exists', () => {
    it('should discard previous select, select 1 and transform to boolean', async () => {
      const q = db.user.select('Id').notExists();

      assertType<Awaited<typeof q>, boolean>();

      expect(await q).toBe(true);

      await db.user.insert(UserData);

      expect(await q).toBe(false);

      expectSql(q.toSQL(), 'SELECT false FROM "schema"."user" LIMIT 1');
    });

    it('should coalesce value in sub-select', async () => {
      const q = db.user.select({
        hasProfile: (q) => q.profile.notExists(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT COALESCE("hasProfile"."hasProfile", true) "hasProfile"
          FROM "schema"."user"
          LEFT JOIN LATERAL (
            SELECT false "hasProfile"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id"
              AND "profile"."profile_key" = "user"."user_key"
          ) "hasProfile" ON true
        `,
      );
    });
  });
});
