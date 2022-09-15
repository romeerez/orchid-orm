import { db } from '../test-utils/test-db';
import {
  AssertEqual,
  expectSql,
  insertProfile,
  insertUser,
  profileData,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { User, Profile } from '../test-utils/test-models';
import { RelationQuery } from 'pqb';

describe('hasOne', () => {
  useTestDatabase();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const profileQuery = db.profile.takeOrThrow();

      const eq: AssertEqual<
        typeof db.user.profile,
        RelationQuery<
          'profile',
          { id: number },
          'userId',
          typeof profileQuery,
          true
        >
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

    it('should have insert with defaults of provided id', () => {
      const user = { id: 1 };
      const now = new Date();

      const query = db.user.profile(user).insert({
        bio: 'bio',
        updatedAt: now,
        createdAt: now,
      });

      expectSql(
        query.toSql(),
        `
        INSERT INTO "profile"("userId", "bio", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4)
      `,
        [1, 'bio', now, now],
      );
    });

    it('can insert after calling method', async () => {
      const id = await insertUser();
      const now = new Date();
      await db.user.profile({ id }).insert({
        userId: id,
        bio: 'bio',
        updatedAt: now,
        createdAt: now,
      });
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

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.user.select(
          'id',
          db.user.profile.where({ bio: 'bio' }),
        );

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profile: Profile }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT row_to_json("t".*) AS "json"
                FROM (
                  SELECT "profile".* FROM "profile"
                  WHERE "profile"."userId" = "user"."id"
                    AND "profile"."bio" = $1
                  LIMIT $2
                ) AS "t"
              ) AS "profile"
            FROM "user"
          `,
          ['bio', 1],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.user.select('id', 'profile');

        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profile: Profile }[]
        > = true;
        expect(eq).toBe(true);

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT row_to_json("t".*) AS "json"
                FROM (
                  SELECT "profile".* FROM "profile"
                  WHERE "profile"."userId" = "user"."id"
                  LIMIT $1
                ) AS "t"
              ) AS "profile"
            FROM "user"
          `,
          [1],
        );
      });
    });

    describe('insert', () => {
      const now = new Date();
      const userData = {
        password: 'password',
        updatedAt: now,
        createdAt: now,
      };

      const profileData = {
        updatedAt: now,
        createdAt: now,
      };

      const checkUserAndProfile = ({
        user,
        profile,
        name,
        bio,
      }: {
        user: User;
        profile: Profile;
        name: string;
        bio: string;
      }) => {
        expect(user).toEqual({
          id: user.id,
          name,
          active: null,
          age: null,
          data: null,
          picture: null,
          ...userData,
        });

        expect(profile).toEqual({
          id: profile.id,
          bio,
          userId: user.id,
          ...profileData,
        });
      };

      it('should support create', async () => {
        const query = db.user.insert(
          {
            name: 'user',
            ...userData,
            profile: {
              create: {
                bio: 'profile',
                ...profileData,
              },
            },
          },
          '*',
        );

        const user = await query;
        const profile = await db.profile.findBy({ userId: user.id });

        checkUserAndProfile({ user, profile, name: 'user', bio: 'profile' });
      });

      it('should support create many', async () => {
        const query = db.user.insert(
          [
            {
              name: 'user 1',
              ...userData,
              profile: {
                create: {
                  bio: 'profile 1',
                  ...profileData,
                },
              },
            },
            {
              name: 'user 2',
              ...userData,
              profile: {
                create: {
                  bio: 'profile 2',
                  ...profileData,
                },
              },
            },
          ],
          '*',
        );

        const users = await query;
        const profiles = await db.profile
          .where({
            userId: { in: users.map((user) => user.id) },
          })
          .order({ id: 'ASC' });

        checkUserAndProfile({
          user: users[0],
          profile: profiles[0],
          name: 'user 1',
          bio: 'profile 1',
        });

        checkUserAndProfile({
          user: users[1],
          profile: profiles[1],
          name: 'user 2',
          bio: 'profile 2',
        });
      });

      it('should support connect', async () => {
        await db.profile.insert({
          bio: 'profile',
          ...profileData,
          user: {
            create: {
              name: 'tmp',
              ...userData,
            },
          },
        });

        const query = db.user.insert(
          {
            name: 'user',
            ...userData,
            profile: {
              connect: { bio: 'profile' },
            },
          },
          '*',
        );

        const user = await query;
        const profile = await db.user.profile(user);

        checkUserAndProfile({ user, profile, name: 'user', bio: 'profile' });
      });

      it('should support connect many', async () => {
        await db.profile.insert([
          {
            bio: 'profile 1',
            ...profileData,
            user: {
              create: {
                name: 'tmp',
                ...userData,
              },
            },
          },
          {
            bio: 'profile 2',
            ...profileData,
            user: {
              connect: { name: 'tmp' },
            },
          },
        ]);

        const query = db.user.insert(
          [
            {
              name: 'user 1',
              ...userData,
              profile: {
                connect: { bio: 'profile 1' },
              },
            },
            {
              name: 'user 2',
              ...userData,
              profile: {
                connect: { bio: 'profile 2' },
              },
            },
          ],
          '*',
        );

        const users = await query;
        const profiles = await db.profile
          .where({
            userId: { in: users.map((user) => user.id) },
          })
          .order({ id: 'ASC' });

        checkUserAndProfile({
          user: users[0],
          profile: profiles[0],
          name: 'user 1',
          bio: 'profile 1',
        });

        checkUserAndProfile({
          user: users[1],
          profile: profiles[1],
          name: 'user 2',
          bio: 'profile 2',
        });
      });

      it('should support connect or create', async () => {
        const { id: profileId } = await db.profile.insert(
          {
            bio: 'profile 1',
            ...profileData,
            user: {
              create: {
                name: 'tmp',
                ...userData,
              },
            },
          },
          ['id'],
        );

        const user1 = await db.user.insert(
          {
            name: 'user 1',
            ...userData,
            profile: {
              connect: { bio: 'profile 1' },
              create: { bio: 'profile 1', ...profileData },
            },
          },
          '*',
        );

        const user2 = await db.user.insert(
          {
            name: 'user 2',
            ...userData,
            profile: {
              connect: { bio: 'profile 2' },
              create: { bio: 'profile 2', ...profileData },
            },
          },
          '*',
        );

        const profile1 = await db.user.profile(user1);
        expect(profile1.id).toBe(profileId);
        checkUserAndProfile({
          user: user1,
          profile: profile1,
          name: 'user 1',
          bio: 'profile 1',
        });

        const profile2 = await db.user.profile(user2);
        checkUserAndProfile({
          user: user2,
          profile: profile2,
          name: 'user 2',
          bio: 'profile 2',
        });
      });

      it('should support connect or create many', async () => {
        const { id: profileId } = await db.profile.insert(
          {
            bio: 'profile 1',
            ...profileData,
            user: {
              create: {
                name: 'tmp',
                ...userData,
              },
            },
          },
          ['id'],
        );

        const [user1, user2] = await db.user.insert(
          [
            {
              name: 'user 1',
              ...userData,
              profile: {
                connect: { bio: 'profile 1' },
                create: { bio: 'profile 1', ...profileData },
              },
            },
            {
              name: 'user 2',
              ...userData,
              profile: {
                connect: { bio: 'profile 2' },
                create: { bio: 'profile 2', ...profileData },
              },
            },
          ],
          '*',
        );

        const profile1 = await db.user.profile(user1);
        expect(profile1.id).toBe(profileId);
        checkUserAndProfile({
          user: user1,
          profile: profile1,
          name: 'user 1',
          bio: 'profile 1',
        });

        const profile2 = await db.user.profile(user2);
        checkUserAndProfile({
          user: user2,
          profile: profile2,
          name: 'user 2',
          bio: 'profile 2',
        });
      });
    });

    describe('update', () => {
      describe('disconnect', () => {
        it('should nullify foreignKey', async () => {
          const user = await db.user.insert(
            { ...userData, profile: { create: profileData } },
            ['id'],
          );
          const { id: profileId } = await db.user.profile(user);

          await db.user.where(user).update({
            profile: {
              disconnect: true,
            },
          });

          const profile = await db.profile.find(profileId).takeOrThrow();
          expect(profile.userId).toBe(null);
        });
      });
    });
  });
});

describe('hasOne through', () => {
  it('should have method to query related data', async () => {
    const profileQuery = db.profile.takeOrThrow();

    const eq: AssertEqual<
      typeof db.message.profile,
      RelationQuery<
        'profile',
        { authorId: number },
        never,
        typeof profileQuery,
        true
      >
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

  describe('select', () => {
    it('should be selectable', () => {
      const query = db.message.select(
        'id',
        db.message.profile.where({ bio: 'bio' }),
      );

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; profile: Profile }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "message"."id",
            (
              SELECT row_to_json("t".*) AS "json"
              FROM (
                SELECT "profile".* FROM "profile"
                WHERE EXISTS (
                    SELECT 1 FROM "user"
                    WHERE "profile"."userId" = "user"."id"
                      AND "user"."id" = "message"."authorId"
                    LIMIT 1
                  )
                  AND "profile"."bio" = $1
                LIMIT $2
              ) AS "t"
            ) AS "profile"
          FROM "message"
        `,
        ['bio', 1],
      );
    });

    it('should be selectable by relation name', () => {
      const query = db.message.select('id', 'profile');

      const eq: AssertEqual<
        Awaited<typeof query>,
        { id: number; profile: Profile }[]
      > = true;
      expect(eq).toBe(true);

      expectSql(
        query.toSql(),
        `
          SELECT
            "message"."id",
            (
              SELECT row_to_json("t".*) AS "json"
              FROM (
                SELECT "profile".* FROM "profile"
                WHERE EXISTS (
                    SELECT 1 FROM "user"
                    WHERE "profile"."userId" = "user"."id"
                      AND "user"."id" = "message"."authorId"
                    LIMIT 1
                  )
                LIMIT $1
              ) AS "t"
            ) AS "profile"
          FROM "message"
        `,
        [1],
      );
    });
  });
});
