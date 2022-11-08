import { db, pgConfig } from '../test-utils/test-db';
import {
  assertType,
  chatData,
  expectSql,
  profileData,
  userData,
  useTestDatabase,
} from '../test-utils/test-utils';
import { User, Profile, Model } from '../test-utils/test-models';
import { RelationQuery } from 'pqb';
import { porm } from '../orm';

describe('hasOne', () => {
  useTestDatabase();

  describe('querying', () => {
    it('should have method to query related data', async () => {
      const profileQuery = db.profile.take();

      assertType<
        typeof db.user.profile,
        RelationQuery<
          'profile',
          { id: number },
          'userId',
          typeof profileQuery,
          true,
          true
        >
      >();

      const userId = await db.user.get('id').create(userData);

      await db.profile.create({ ...profileData, userId });

      const user = await db.user.find(userId);
      const query = db.user.profile(user);

      expectSql(
        query.toSql(),
        `
        SELECT * FROM "profile"
        WHERE "profile"."userId" = $1
        LIMIT $2
      `,
        [userId, 1],
      );

      const profile = await query;

      expect(profile).toMatchObject(profileData);
    });

    it('should have create with defaults of provided id', () => {
      const user = { id: 1 };
      const now = new Date();

      const query = db.user.profile(user).count().create({
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

    it('can create after calling method', async () => {
      const id = await db.user.get('id').create(userData);
      const now = new Date();
      await db.user.profile({ id }).create({
        userId: id,
        bio: 'bio',
        updatedAt: now,
        createdAt: now,
      });
    });

    describe('create based on a query', () => {
      it('should have create based on find query', () => {
        const query = db.user.find(1).profile.create({
          bio: 'bio',
        });

        expectSql(
          query.toSql(),
          `
          INSERT INTO "profile"("userId", "bio")
          SELECT "user"."id" AS "userId", $1
          FROM "user"
          WHERE "user"."id" = $2
          LIMIT $3
          RETURNING *
        `,
          ['bio', 1, 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.user.profile.create({
              bio: 'bio',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.user.relations.profile
          .joinQuery(db.user.as('u'), db.profile.as('p'))
          .toSql(),
        `
          SELECT * FROM "profile" AS "p"
          WHERE "p"."userId" = "u"."id"
          LIMIT $1
        `,
        [1],
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.as('u').whereExists('profile').toSql(),
        `
        SELECT * FROM "user" AS "u"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "u"."id"
          LIMIT 1
        )
      `,
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('profile', (q) => q.where({ bio: 'bio' }))
          .toSql(),
        `
        SELECT * FROM "user" AS "u"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "u"."id"
            AND "profile"."bio" = $1
          LIMIT 1
        )
      `,
        ['bio'],
      );
    });

    it('should be supported in join', () => {
      const query = db.user
        .as('u')
        .join('profile', (q) => q.where({ bio: 'bio' }))
        .select('name', 'profile.bio');

      assertType<
        Awaited<typeof query>,
        { name: string; bio: string | null }[]
      >();

      expectSql(
        query.toSql(),
        `
        SELECT "u"."name", "profile"."bio" FROM "user" AS "u"
        JOIN "profile"
          ON "profile"."userId" = "u"."id"
         AND "profile"."bio" = $1
      `,
        ['bio'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.user.as('u').select('id', {
          profile: (q) => q.profile.where({ bio: 'bio' }),
        });

        assertType<Awaited<typeof query>, { id: number; profile: Profile }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "u"."id",
              (
                SELECT row_to_json("t".*)
                FROM (
                  SELECT * FROM "profile"
                  WHERE "profile"."userId" = "u"."id"
                    AND "profile"."bio" = $1
                  LIMIT $2
                ) AS "t"
              ) AS "profile"
            FROM "user" AS "u"
          `,
          ['bio', 1],
        );
      });

      it('should be selectable by relation name', () => {
        const query = db.user.select('id', 'profile');

        assertType<Awaited<typeof query>, { id: number; profile: Profile }[]>();

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT row_to_json("t".*) 
                FROM (
                  SELECT * FROM "profile"
                  WHERE "profile"."userId" = "user"."id"
                  LIMIT $1
                ) AS "t"
              ) AS "profile"
            FROM "user"
          `,
          [1],
        );
      });

      it('should handle exists sub query', () => {
        const query = db.user.as('u').select('id', {
          hasProfile: (q) => q.profile.exists(),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; hasProfile: boolean }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "u"."id",
              COALESCE((
                SELECT true
                FROM "profile"
                WHERE "profile"."userId" = "u"."id"
              ), false) AS "hasProfile"
            FROM "user" AS "u"
          `,
        );
      });
    });

    describe('create', () => {
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
          ...userData,
          id: user.id,
          name,
          active: null,
          age: null,
          data: null,
          picture: null,
        });

        expect(profile).toMatchObject({
          id: profile.id,
          bio,
          userId: user.id,
        });
      };

      describe('nested create', () => {
        it('should support create', async () => {
          const query = db.user.create({
            ...userData,
            name: 'user',
            profile: {
              create: {
                ...profileData,
                bio: 'profile',
              },
            },
          });

          const user = await query;
          const profile = await db.profile.findBy({ userId: user.id });

          checkUserAndProfile({ user, profile, name: 'user', bio: 'profile' });
        });

        it('should support create many', async () => {
          const query = db.user.createMany([
            {
              ...userData,
              name: 'user 1',
              profile: {
                create: {
                  ...profileData,
                  bio: 'profile 1',
                },
              },
            },
            {
              ...userData,
              name: 'user 2',
              profile: {
                create: {
                  ...profileData,
                  bio: 'profile 2',
                },
              },
            },
          ]);

          const users = await query;
          const profiles = await db.profile
            .where({
              userId: { in: users.map((user) => user.id) },
            })
            .order('id');

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
      });

      describe('nested connect', () => {
        it('should support connect', async () => {
          await db.profile.create({
            ...profileData,
            bio: 'profile',
            user: {
              create: {
                ...userData,
                name: 'tmp',
              },
            },
          });

          const query = db.user.create({
            ...userData,
            name: 'user',
            profile: {
              connect: { bio: 'profile' },
            },
          });

          const user = await query;
          const profile = await db.user.profile(user);

          checkUserAndProfile({ user, profile, name: 'user', bio: 'profile' });
        });

        it('should support connect many', async () => {
          await db.profile.createMany([
            {
              ...profileData,
              bio: 'profile 1',
              user: {
                create: {
                  ...userData,
                  name: 'tmp',
                },
              },
            },
            {
              ...profileData,
              bio: 'profile 2',
              user: {
                connect: { name: 'tmp' },
              },
            },
          ]);

          const query = db.user.createMany([
            {
              ...userData,
              name: 'user 1',
              profile: {
                connect: { bio: 'profile 1' },
              },
            },
            {
              ...userData,
              name: 'user 2',
              profile: {
                connect: { bio: 'profile 2' },
              },
            },
          ]);

          const users = await query;
          const profiles = await db.profile
            .where({
              userId: { in: users.map((user) => user.id) },
            })
            .order('id');

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
      });

      describe('connect or create', () => {
        it('should support connect or create', async () => {
          const profileId = await db.profile.get('id').create({
            ...profileData,
            bio: 'profile 1',
            user: {
              create: {
                ...userData,
                name: 'tmp',
              },
            },
          });

          const user1 = await db.user.create({
            ...userData,
            name: 'user 1',
            profile: {
              connectOrCreate: {
                where: { bio: 'profile 1' },
                create: { ...profileData, bio: 'profile 1' },
              },
            },
          });

          const user2 = await db.user.create({
            ...userData,
            name: 'user 2',
            profile: {
              connectOrCreate: {
                where: { bio: 'profile 2' },
                create: { ...profileData, bio: 'profile 2' },
              },
            },
          });

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
          const profileId = await db.profile.get('id').create({
            ...profileData,
            bio: 'profile 1',
            user: {
              create: {
                ...userData,
                name: 'tmp',
              },
            },
          });

          const [user1, user2] = await db.user.createMany([
            {
              ...userData,
              name: 'user 1',
              profile: {
                connectOrCreate: {
                  where: { bio: 'profile 1' },
                  create: { ...profileData, bio: 'profile 1' },
                },
              },
            },
            {
              ...userData,
              name: 'user 2',
              profile: {
                connectOrCreate: {
                  where: { bio: 'profile 2' },
                  create: { ...profileData, bio: 'profile 2' },
                },
              },
            },
          ]);

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
    });

    describe('update', () => {
      describe('disconnect', () => {
        it('should nullify foreignKey', async () => {
          const user = await db.user
            .selectAll()
            .create({ ...userData, profile: { create: profileData } });
          const { id: profileId } = await db.user.profile(user);

          const id = await db.user
            .get('id')
            .where(user)
            .update({
              profile: {
                disconnect: true,
              },
            });

          expect(id).toBe(user.id);

          const profile = await db.profile.find(profileId);
          expect(profile.userId).toBe(null);
        });

        it('should nullify foreignKey in batch update', async () => {
          const userIds = await db.user.pluck('id').createMany([
            { ...userData, profile: { create: profileData } },
            { ...userData, profile: { create: profileData } },
          ]);

          const profileIds = await db.profile.pluck('id').where({
            userId: { in: userIds },
          });

          await db.user.where({ id: { in: userIds } }).update({
            profile: {
              disconnect: true,
            },
          });

          const updatedUserIds = await db.profile
            .pluck('userId')
            .where({ id: { in: profileIds } });
          expect(updatedUserIds).toEqual([null, null]);
        });
      });

      describe('set', () => {
        it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
          const id = await db.user.get('id').create(userData);

          const [{ id: profile1Id }, { id: profile2Id }] = await db.profile
            .select('id')
            .createMany([{ ...profileData, userId: id }, { ...profileData }]);

          await db.user.find(id).update({
            profile: {
              set: { id: profile2Id },
            },
          });

          const profile1 = await db.profile.find(profile1Id);
          expect(profile1.userId).toBe(null);

          const profile2 = await db.profile.find(profile2Id);
          expect(profile2.userId).toBe(id);
        });

        it('should throw in batch update', async () => {
          const query = db.user.where({ id: { in: [1, 2, 3] } }).update({
            profile: {
              // @ts-expect-error not allows in batch update
              set: { id: 1 },
            },
          });

          await expect(query).rejects.toThrow();
        });
      });

      describe('delete', () => {
        it('should delete related record', async () => {
          const id = await db.user
            .get('id')
            .create({ ...userData, profile: { create: profileData } });

          const { id: profileId } = await db.user
            .profile({ id })
            .select('id')
            .take();

          await db.user.find(id).update({
            profile: {
              delete: true,
            },
          });

          const profile = await db.profile.findByOptional({ id: profileId });
          expect(profile).toBe(undefined);
        });

        it('should delete related record in batch update', async () => {
          const userIds = await db.user.pluck('id').createMany([
            { ...userData, profile: { create: profileData } },
            { ...userData, profile: { create: profileData } },
          ]);

          await db.user.where({ id: { in: userIds } }).update({
            profile: {
              delete: true,
            },
          });

          const count = await db.profile.count();
          expect(count).toBe(0);
        });
      });

      describe('nested update', () => {
        it('should update related record', async () => {
          const id = await db.user
            .get('id')
            .create({ ...userData, profile: { create: profileData } });

          await db.user.find(id).update({
            profile: {
              update: {
                bio: 'updated',
              },
            },
          });

          const profile = await db.user.profile({ id }).take();
          expect(profile.bio).toBe('updated');
        });

        it('should update related record in batch update', async () => {
          const userIds = await db.user.pluck('id').createMany([
            { ...userData, profile: { create: profileData } },
            { ...userData, profile: { create: profileData } },
          ]);

          await db.user.where({ id: { in: userIds } }).update({
            profile: {
              update: {
                bio: 'updated',
              },
            },
          });

          const bios = await db.profile.pluck('bio');
          expect(bios).toEqual(['updated', 'updated']);
        });
      });

      describe('nested upsert', () => {
        it('should update related record if it exists', async () => {
          const user = await db.user.create({
            ...userData,
            profile: { create: profileData },
          });

          await db.user.find(user.id).update({
            profile: {
              upsert: {
                update: {
                  bio: 'updated',
                },
                create: profileData,
              },
            },
          });

          const profile = await db.user.profile(user);
          expect(profile.bio).toBe('updated');
        });

        it('should create related record if it does not exists', async () => {
          const user = await db.user.create(userData);

          await db.user.find(user.id).update({
            profile: {
              upsert: {
                update: {
                  bio: 'updated',
                },
                create: {
                  ...profileData,
                  bio: 'created',
                },
              },
            },
          });

          const profile = await db.user.profile(user);
          expect(profile.bio).toBe('created');
        });

        it('should throw in batch update', async () => {
          const query = db.user.where({ id: { in: [1, 2, 3] } }).update({
            profile: {
              // @ts-expect-error not allows in batch update
              upsert: {
                update: {
                  bio: 'updated',
                },
                create: {
                  ...profileData,
                  bio: 'created',
                },
              },
            },
          });

          await expect(query).rejects.toThrow();
        });
      });

      describe('nested create', () => {
        it('should create new related record', async () => {
          const userId = await db.user
            .get('id')
            .create({ ...userData, profile: { create: profileData } });

          const previousProfileId = await db.user
            .profile({ id: userId })
            .get('id');

          const updated = await db.user
            .selectAll()
            .find(userId)
            .update({
              profile: {
                create: { ...profileData, bio: 'created' },
              },
            });

          const previousProfile = await db.profile.find(previousProfileId);
          expect(previousProfile.userId).toBe(null);

          const profile = await db.user.profile(updated);
          expect(profile.bio).toBe('created');
        });

        it('should throw in batch update', async () => {
          const query = db.user.where({ id: { in: [1, 2, 3] } }).update({
            profile: {
              // @ts-expect-error not allows in batch update
              create: {
                ...profileData,
                bio: 'created',
              },
            },
          });

          await expect(query).rejects.toThrow();
        });
      });
    });
  });
});

describe('hasOne through', () => {
  it('should resolve recursive situation when both models depends on each other', () => {
    class Post extends Model {
      table = 'post';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
      }));

      relations = {
        postTag: this.hasOne(() => PostTag, {
          primaryKey: 'id',
          foreignKey: 'postId',
        }),

        tag: this.hasOne(() => Tag, {
          through: 'postTag',
          source: 'tag',
        }),
      };
    }

    class Tag extends Model {
      table = 'tag';
      columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
      }));

      relations = {
        postTag: this.hasOne(() => PostTag, {
          primaryKey: 'id',
          foreignKey: 'postId',
        }),

        post: this.hasOne(() => Post, {
          through: 'postTag',
          source: 'post',
        }),
      };
    }

    class PostTag extends Model {
      table = 'postTag';
      columns = this.setColumns((t) => ({
        postId: t.integer().foreignKey(() => Post, 'id'),
        tagId: t.integer().foreignKey(() => Tag, 'id'),
      }));

      relations = {
        post: this.belongsTo(() => Post, {
          primaryKey: 'id',
          foreignKey: 'postId',
        }),

        tag: this.belongsTo(() => Tag, {
          primaryKey: 'id',
          foreignKey: 'tagId',
        }),
      };
    }

    const db = porm(
      {
        ...pgConfig,
        log: false,
      },
      {
        post: Post,
        tag: Tag,
        postTag: PostTag,
      },
    );

    expect(Object.keys(db.post.relations)).toEqual(['postTag', 'tag']);
    expect(Object.keys(db.tag.relations)).toEqual(['postTag', 'post']);
  });

  it('should have method to query related data', async () => {
    const profileQuery = db.profile.take();

    assertType<
      typeof db.message.profile,
      RelationQuery<
        'profile',
        { authorId: number | null },
        never,
        typeof profileQuery,
        true
      >
    >();

    const query = db.message.profile({ authorId: 1 });
    expectSql(
      query.toSql(),
      `
        SELECT * FROM "profile"
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

  it('should have disabled create method', () => {
    // @ts-expect-error hasOne with through option should not have chained create
    db.message.profile.create(chatData);
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.message.relations.profile
        .joinQuery(db.message.as('m'), db.profile.as('p'))
        .toSql(),
      `
        SELECT * FROM "profile" AS "p"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "p"."userId" = "user"."id"
            AND "user"."id" = "m"."authorId"
          LIMIT 1
        )
        LIMIT $1
      `,
      [1],
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.message.whereExists('profile').toSql(),
      `
        SELECT * FROM "message"
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
        .as('m')
        .whereExists('profile', (q) => q.where({ bio: 'bio' }))
        .toSql(),
      `
        SELECT * FROM "message" AS "m"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "m"."authorId"
            LIMIT 1
          )
          AND "profile"."bio" = $1
          LIMIT 1
        )
      `,
      ['bio'],
    );
  });

  it('should be supported in join', () => {
    const query = db.message
      .as('m')
      .join('profile', (q) => q.where({ bio: 'bio' }))
      .select('text', 'profile.bio');

    assertType<Awaited<typeof query>, { text: string; bio: string | null }[]>();

    expectSql(
      query.toSql(),
      `
        SELECT "m"."text", "profile"."bio" FROM "message" AS "m"
        JOIN "profile"
          ON EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "m"."authorId"
            LIMIT 1
          )
          AND "profile"."bio" = $1
      `,
      ['bio'],
    );
  });

  describe('select', () => {
    it('should be selectable', () => {
      const query = db.message.as('m').select('id', {
        profile: (q) => q.profile.where({ bio: 'bio' }),
      });

      assertType<Awaited<typeof query>, { id: number; profile: Profile }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "m"."id",
            (
              SELECT row_to_json("t".*)
              FROM (
                SELECT * FROM "profile"
                WHERE EXISTS (
                    SELECT 1 FROM "user"
                    WHERE "profile"."userId" = "user"."id"
                      AND "user"."id" = "m"."authorId"
                    LIMIT 1
                  )
                  AND "profile"."bio" = $1
                LIMIT $2
              ) AS "t"
            ) AS "profile"
          FROM "message" AS "m"
        `,
        ['bio', 1],
      );
    });

    it('should be selectable by relation name', () => {
      const query = db.message.select('id', 'profile');

      assertType<Awaited<typeof query>, { id: number; profile: Profile }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            "message"."id",
            (
              SELECT row_to_json("t".*)
              FROM (
                SELECT * FROM "profile"
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

    it('should handle exists sub query', () => {
      const query = db.message.as('m').select('id', {
        hasProfile: (q) => q.profile.exists(),
      });

      assertType<
        Awaited<typeof query>,
        { id: number; hasProfile: boolean }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT
            "m"."id",
            COALESCE((
              SELECT true
              FROM "profile"
              WHERE EXISTS (
                  SELECT 1 FROM "user"
                  WHERE "profile"."userId" = "user"."id"
                    AND "user"."id" = "m"."authorId"
                  LIMIT 1
                )
            ), false) AS "hasProfile"
          FROM "message" AS "m"
        `,
      );
    });
  });
});
