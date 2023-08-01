import {
  User,
  Profile,
  BaseTable,
  db,
  useRelationCallback,
  chatData,
  profileData,
  userData,
  messageSelectAll,
  profileSelectAll,
  userSelectAll,
  useTestORM,
  messageData,
} from '../test-utils/test-utils';
import { Db } from 'pqb';
import { orchidORM } from '../orm';
import { assertType, expectSql } from 'test-utils';

useTestORM();

describe('hasOne', () => {
  describe('querying', () => {
    it('should have method to query related data', async () => {
      const UserId = await db.user.get('Id').create(userData);

      await db.profile.create({ ...profileData, UserId });

      const user = await db.user.find(UserId);
      const query = db.user.profile(user);

      expectSql(
        query.toSQL(),
        `
        SELECT ${profileSelectAll} FROM "profile"
        WHERE "profile"."userId" = $1
      `,
        [UserId],
      );

      const profile = await query;

      expect(profile).toMatchObject(profileData);
    });

    it('should handle chained query', () => {
      const query = db.user
        .where({ Name: 'name' })
        .profile.where({ Bio: 'bio' });

      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile"
          WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "user"."name" = $1
                AND "user"."id" = "profile"."userId"
            )
            AND "profile"."bio" = $2
        `,
        ['name', 'bio'],
      );
    });

    it('should have create with defaults of provided id', () => {
      const user = { Id: 1 };
      const now = new Date();

      const query = db.user.profile(user).count().create({
        Bio: 'bio',
        updatedAt: now,
        createdAt: now,
      });

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "profile"("userId", "bio", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4)
      `,
        [1, 'bio', now, now],
      );
    });

    it('can create after calling method', async () => {
      const Id = await db.user.get('Id').create(userData);
      const now = new Date();
      await db.user.profile({ Id }).create({
        UserId: Id,
        Bio: 'bio',
        updatedAt: now,
        createdAt: now,
      });
    });

    describe('chained create', () => {
      it('should have create based on find query', () => {
        const query = db.user.find(1).profile.create({
          Bio: 'bio',
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "profile"("userId", "bio")
            SELECT "user"."id" AS "UserId", $1
            FROM "user"
            WHERE "user"."id" = $2
            LIMIT 1
            RETURNING ${profileSelectAll}
          `,
          ['bio', 1],
        );
      });

      it('should throw when the main query returns many records', async () => {
        await expect(
          async () =>
            await db.user.profile.create({
              Bio: 'bio',
            }),
        ).rejects.toThrow(
          'Cannot create based on a query which returns multiple records',
        );
      });

      it('should throw when main record is not found', async () => {
        const q = db.user.find(1).profile.create({
          Bio: 'bio',
        });

        await expect(q).rejects.toThrow('Record is not found');
      });

      it('should not throw when searching with findOptional', async () => {
        await db.user.findOptional(1).profile.takeOptional().create({
          Bio: 'bio',
        });
      });
    });

    describe('chained delete', () => {
      it('should delete relation records', () => {
        const query = db.user
          .where({ Name: 'name' })
          .profile.where({ Bio: 'bio' })
          .delete();

        expectSql(
          query.toSQL(),
          `
            DELETE FROM "profile"
            WHERE EXISTS (
                SELECT 1 FROM "user"
                WHERE "user"."name" = $1
                  AND "user"."id" = "profile"."userId"
              )
              AND "profile"."bio" = $2
          `,
          ['name', 'bio'],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        db.user.relations.profile.relationConfig
          .joinQuery(db.user.as('u'), db.profile.as('p'))
          .toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" AS "p"
          WHERE "p"."userId" = "u"."id"
        `,
      );
    });

    it('should be supported in whereExists', () => {
      expectSql(
        db.user.as('u').whereExists('profile').toSQL(),
        `
        SELECT ${userSelectAll} FROM "user" AS "u"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "u"."id"
        )
      `,
      );

      expectSql(
        db.user
          .as('u')
          .whereExists('profile', (q) => q.where({ Bio: 'bio' }))
          .toSQL(),
        `
        SELECT ${userSelectAll} FROM "user" AS "u"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE "profile"."userId" = "u"."id"
            AND "profile"."bio" = $1
        )
      `,
        ['bio'],
      );
    });

    it('should be supported in join', () => {
      const query = db.user
        .as('u')
        .join('profile', (q) => q.where({ Bio: 'bio' }))
        .select('Name', 'profile.Bio');

      assertType<
        Awaited<typeof query>,
        { Name: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
        SELECT "u"."name" AS "Name", "profile"."bio" AS "Bio"
        FROM "user" AS "u"
        JOIN "profile"
          ON "profile"."userId" = "u"."id"
         AND "profile"."bio" = $1
      `,
        ['bio'],
      );
    });

    it('should be supported in join with a callback', () => {
      const query = db.user
        .as('u')
        .join(
          (q) => q.profile.as('p').where({ UserId: 123 }),
          (q) => q.where({ Bio: 'bio' }),
        )
        .select('Name', 'p.Bio');

      assertType<
        Awaited<typeof query>,
        { Name: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
        SELECT "u"."name" AS "Name", "p"."bio" AS "Bio"
        FROM "user" AS "u"
        JOIN "profile" AS "p"
         ON "p"."bio" = $1
         AND "p"."userId" = $2
         AND "p"."userId" = "u"."id"
      `,
        ['bio', 123],
      );
    });

    it('should be supported in joinLateral', () => {
      const q = db.user
        .joinLateral('profile', (q) => q.as('p').where({ Bio: 'one' }))
        .where({ 'p.Bio': 'two' })
        .select('Name', 'p.*');

      assertType<Awaited<typeof q>, { Name: string; p: Profile }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "user"."name" AS "Name", row_to_json("p".*) "p"
          FROM "user"
          JOIN LATERAL (
            SELECT ${profileSelectAll}
            FROM "profile" AS "p"
            WHERE "p"."bio" = $1 AND "p"."userId" = "user"."id"
          ) "p" ON true
          WHERE "p"."Bio" = $2
        `,
        ['one', 'two'],
      );
    });

    describe('select', () => {
      it('should be selectable', () => {
        const query = db.user
          .as('u')
          .select('Id', {
            profile: (q) => q.profile.where({ Bio: 'bio' }),
          })
          .order('profile.Bio');

        assertType<Awaited<typeof query>, { Id: number; profile: Profile }[]>();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "u"."id" AS "Id",
              row_to_json("profile".*) "profile"
            FROM "user" AS "u"
            LEFT JOIN LATERAL (
              SELECT ${profileSelectAll}
              FROM "profile"
              WHERE "profile"."bio" = $1
                AND "profile"."userId" = "u"."id"
            ) "profile" ON true
            ORDER BY "profile"."Bio" ASC
          `,
          ['bio'],
        );
      });

      it('should handle exists sub query', () => {
        const query = db.user.as('u').select('Id', {
          hasProfile: (q) => q.profile.exists(),
        });

        assertType<
          Awaited<typeof query>,
          { Id: number; hasProfile: boolean }[]
        >();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "u"."id" AS "Id",
              COALESCE("hasProfile".r, false) "hasProfile"
            FROM "user" AS "u"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "profile"
              WHERE "profile"."userId" = "u"."id"
            ) "hasProfile" ON true
          `,
        );
      });

      it('should support recurring select', () => {
        const q = db.user.select({
          profile: (q) =>
            q.profile.select({
              user: (q) =>
                q.user
                  .select({
                    profile: (q) => q.profile,
                  })
                  .where({ 'profile.Bio': 'bio' }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT row_to_json("profile".*) "profile"
            FROM "user"
            LEFT JOIN LATERAL (
              SELECT row_to_json("user2".*) "user"
              FROM "profile"
              LEFT JOIN LATERAL (
                SELECT row_to_json("profile2".*) "profile"
                FROM "user"
                LEFT JOIN LATERAL (
                  SELECT ${profileSelectAll}
                  FROM "profile"
                  WHERE "profile"."userId" = "user"."id"
                ) "profile2" ON true
                WHERE "profile2"."Bio" = $1
                  AND "user"."id" = "profile"."userId"
              ) "user2" ON true
              WHERE "profile"."userId" = "user"."id"
            ) "profile" ON true
          `,
          ['bio'],
        );
      });

      it('should be selectable for update', () => {
        const q = db.profile.all().update({
          Bio: (q) => q.user.get('Name'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "profile"
            SET
              "bio" = (
                SELECT "user"."name" AS "Name"
                FROM "user"
                WHERE "user"."id" = "profile"."userId"
              ),
              "updatedAt" = now()
          `,
        );
      });
    });

    describe('create', () => {
      const checkUserAndProfile = ({
        user,
        profile,
        Name,
        Bio,
      }: {
        user: User;
        profile: Profile;
        Name: string;
        Bio: string;
      }) => {
        expect(user).toEqual({
          ...userData,
          Id: user.Id,
          Name,
          Active: null,
          Age: null,
          Data: null,
          Picture: null,
        });

        expect(profile).toMatchObject({
          Id: profile.Id,
          Bio,
          UserId: user.Id,
        });
      };

      describe('nested create', () => {
        it('should support create', async () => {
          const query = db.user.create({
            ...userData,
            Name: 'user',
            profile: {
              create: {
                ...profileData,
                Bio: 'profile',
              },
            },
          });

          const user = await query;
          const profile = await db.profile.findBy({ UserId: user.Id });

          checkUserAndProfile({ user, profile, Name: 'user', Bio: 'profile' });
        });

        it('should support create many', async () => {
          const query = db.user.createMany([
            {
              ...userData,
              Name: 'user 1',
              profile: {
                create: {
                  ...profileData,
                  Bio: 'profile 1',
                },
              },
            },
            {
              ...userData,
              Name: 'user 2',
              profile: {
                create: {
                  ...profileData,
                  Bio: 'profile 2',
                },
              },
            },
          ]);

          const users = await query;
          const profiles = await db.profile
            .where({
              UserId: { in: users.map((user) => user.Id) },
            })
            .order('Id');

          checkUserAndProfile({
            user: users[0],
            profile: profiles[0],
            Name: 'user 1',
            Bio: 'profile 1',
          });

          checkUserAndProfile({
            user: users[1],
            profile: profiles[1],
            Name: 'user 2',
            Bio: 'profile 2',
          });
        });

        describe('relation callbacks', () => {
          const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
            db.user.relations.profile,
            ['Id'],
          );

          it('should invoke callbacks', async () => {
            await db.user.create({
              ...userData,
              profile: {
                create: profileData,
              },
            });

            expect(beforeCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toBeCalledWith(
              [{ Id: expect.any(Number) }],
              expect.any(Db),
            );
          });

          it('should invoke callbacks in a batch create', async () => {
            resetMocks();

            await db.user.createMany([
              {
                ...userData,
                profile: {
                  create: profileData,
                },
              },
              {
                ...userData,
                profile: {
                  create: profileData,
                },
              },
            ]);

            expect(beforeCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toBeCalledWith(
              [{ Id: expect.any(Number) }, { Id: expect.any(Number) }],
              expect.any(Db),
            );
          });
        });
      });

      describe('nested connect', () => {
        it('should support connect', async () => {
          await db.profile.create({
            ...profileData,
            Bio: 'profile',
            user: {
              create: {
                ...userData,
                Name: 'tmp',
              },
            },
          });

          const query = db.user.create({
            ...userData,
            Name: 'user',
            profile: {
              connect: { Bio: 'profile' },
            },
          });

          const user = await query;
          const profile = await db.user.profile(user);

          checkUserAndProfile({ user, profile, Name: 'user', Bio: 'profile' });
        });

        it('should support connect many', async () => {
          await db.profile.createMany([
            {
              ...profileData,
              Bio: 'profile 1',
              user: {
                create: {
                  ...userData,
                  Name: 'tmp',
                },
              },
            },
            {
              ...profileData,
              Bio: 'profile 2',
              user: {
                connect: { Name: 'tmp' },
              },
            },
          ]);

          const query = db.user.createMany([
            {
              ...userData,
              Name: 'user 1',
              profile: {
                connect: { Bio: 'profile 1' },
              },
            },
            {
              ...userData,
              Name: 'user 2',
              profile: {
                connect: { Bio: 'profile 2' },
              },
            },
          ]);

          const users = await query;
          const profiles = await db.profile
            .where({
              UserId: { in: users.map((user) => user.Id) },
            })
            .order('Id');

          checkUserAndProfile({
            user: users[0],
            profile: profiles[0],
            Name: 'user 1',
            Bio: 'profile 1',
          });

          checkUserAndProfile({
            user: users[1],
            profile: profiles[1],
            Name: 'user 2',
            Bio: 'profile 2',
          });
        });

        describe('relation callbacks', () => {
          const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
            db.user.relations.profile,
            ['Id'],
          );

          it('should invoke callbacks', async () => {
            const profileId = await db.profile.get('Id').create(profileData);

            await db.user.count().create({
              ...userData,
              profile: {
                connect: { Id: profileId },
              },
            });

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toBeCalledWith(
              [{ Id: profileId }],
              expect.any(Db),
            );
          });

          it('should invoke callbacks in a batch create', async () => {
            resetMocks();

            const ids = await db.profile
              .pluck('Id')
              .createMany([profileData, profileData]);

            await db.user.createMany([
              {
                ...userData,
                profile: {
                  connect: { Id: ids[0] },
                },
              },
              {
                ...userData,
                profile: {
                  connect: { Id: ids[1] },
                },
              },
            ]);

            expect(beforeUpdate).toHaveBeenCalledTimes(2);
            expect(afterUpdate).toHaveBeenCalledTimes(2);
            expect(afterUpdate.mock.calls).toEqual([
              [[{ Id: ids[0] }], expect.any(Db)],
              [[{ Id: ids[1] }], expect.any(Db)],
            ]);
          });
        });
      });

      describe('connect or create', () => {
        it('should support connect or create', async () => {
          const profileId = await db.profile.get('Id').create({
            ...profileData,
            Bio: 'profile 1',
            user: {
              create: {
                ...userData,
                Name: 'tmp',
              },
            },
          });

          const user1 = await db.user.create({
            ...userData,
            Name: 'user 1',
            profile: {
              connectOrCreate: {
                where: { Bio: 'profile 1' },
                create: { ...profileData, Bio: 'profile 1' },
              },
            },
          });

          const user2 = await db.user.create({
            ...userData,
            Name: 'user 2',
            profile: {
              connectOrCreate: {
                where: { Bio: 'profile 2' },
                create: { ...profileData, Bio: 'profile 2' },
              },
            },
          });

          const profile1 = await db.user.profile(user1);
          expect(profile1.Id).toBe(profileId);
          checkUserAndProfile({
            user: user1,
            profile: profile1,
            Name: 'user 1',
            Bio: 'profile 1',
          });

          const profile2 = await db.user.profile(user2);
          checkUserAndProfile({
            user: user2,
            profile: profile2,
            Name: 'user 2',
            Bio: 'profile 2',
          });
        });

        it('should support connect or create many', async () => {
          const profileId = await db.profile.get('Id').create({
            ...profileData,
            Bio: 'profile 1',
            user: {
              create: {
                ...userData,
                Name: 'tmp',
              },
            },
          });

          const [user1, user2] = await db.user.createMany([
            {
              ...userData,
              Name: 'user 1',
              profile: {
                connectOrCreate: {
                  where: { Bio: 'profile 1' },
                  create: { ...profileData, Bio: 'profile 1' },
                },
              },
            },
            {
              ...userData,
              Name: 'user 2',
              profile: {
                connectOrCreate: {
                  where: { Bio: 'profile 2' },
                  create: { ...profileData, Bio: 'profile 2' },
                },
              },
            },
          ]);

          const profile1 = await db.user.profile(user1);
          expect(profile1.Id).toBe(profileId);
          checkUserAndProfile({
            user: user1,
            profile: profile1,
            Name: 'user 1',
            Bio: 'profile 1',
          });

          const profile2 = await db.user.profile(user2);
          checkUserAndProfile({
            user: user2,
            profile: profile2,
            Name: 'user 2',
            Bio: 'profile 2',
          });
        });
      });

      describe('relation callbacks', () => {
        const {
          beforeUpdate,
          afterUpdate,
          beforeCreate,
          afterCreate,
          resetMocks,
        } = useRelationCallback(db.user.relations.profile, ['Id']);

        it('should invoke callbacks when connecting', async () => {
          const Id = await db.profile.get('Id').create(profileData);

          await db.user.create({
            ...userData,
            profile: {
              connectOrCreate: {
                where: { Id },
                create: profileData,
              },
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ Id }], expect.any(Db));
        });

        it('should invoke callbacks when creating', async () => {
          await db.user.create({
            ...userData,
            profile: {
              connectOrCreate: {
                where: { Id: 0 },
                create: profileData,
              },
            },
          });

          const Id = await db.profile.take().get('Id');

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith([{ Id }], expect.any(Db));
        });

        it('should invoke callbacks in a batch create', async () => {
          resetMocks();

          const Id = await db.profile.get('Id').create(profileData);

          await db.user.createMany([
            {
              ...userData,
              profile: {
                connectOrCreate: {
                  where: { Id: 0 },
                  create: profileData,
                },
              },
            },
            {
              ...userData,
              profile: {
                connectOrCreate: {
                  where: { Id },
                  create: profileData,
                },
              },
            },
          ]);

          const ids = await db.profile.pluck('Id');

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(1);
          expect(afterUpdate).toBeCalledWith([{ Id: ids[0] }], expect.any(Db));

          expect(beforeCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toHaveBeenCalledTimes(1);
          expect(afterCreate).toBeCalledWith([{ Id: ids[1] }], expect.any(Db));
        });
      });
    });

    describe('update', () => {
      describe('disconnect', () => {
        it('should nullify foreignKey', async () => {
          const user = await db.user
            .selectAll()
            .create({ ...userData, profile: { create: profileData } });
          const { Id: profileId } = await db.user.profile(user);

          const Id = await db.user
            .get('Id')
            .where(user)
            .update({
              profile: {
                disconnect: true,
              },
            });

          expect(Id).toBe(user.Id);

          const profile = await db.profile.find(profileId);
          expect(profile.UserId).toBe(null);
        });

        it('should nullify foreignKey in batch update', async () => {
          const userIds = await db.user.pluck('Id').createMany([
            { ...userData, profile: { create: profileData } },
            { ...userData, profile: { create: profileData } },
          ]);

          const profileIds = await db.profile.pluck('Id').where({
            UserId: { in: userIds },
          });

          await db.user.where({ Id: { in: userIds } }).update({
            profile: {
              disconnect: true,
            },
          });

          const updatedUserIds = await db.profile
            .pluck('UserId')
            .where({ Id: { in: profileIds } });
          expect(updatedUserIds).toEqual([null, null]);
        });

        describe('relation callbacks', () => {
          const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
            db.user.relations.profile,
            ['Id'],
          );

          it('should invoke callbacks', async () => {
            const { Id, UserId } = await db.profile
              .select('Id', 'UserId')
              .create({
                ...profileData,
                user: { create: userData },
              });

            await db.user.find(UserId as number).update({
              profile: {
                disconnect: true,
              },
            });

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toBeCalledWith([{ Id: Id }], expect.any(Db));
          });

          it('should invoke callbacks in a batch update', async () => {
            resetMocks();

            const userIds = await db.user.pluck('Id').createMany([
              {
                ...userData,
                profile: { create: profileData },
              },
              {
                ...userData,
                profile: { create: profileData },
              },
            ]);

            await db.user.where({ Id: { in: userIds } }).update({
              profile: {
                disconnect: true,
              },
            });

            const ids = await db.profile.pluck('Id');

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toBeCalledWith(
              [{ Id: ids[0] }, { Id: ids[1] }],
              expect.any(Db),
            );
          });
        });
      });

      describe('set', () => {
        it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
          const Id = await db.user.get('Id').create(userData);

          const [{ Id: profile1Id }, { Id: profile2Id }] = await db.profile
            .select('Id')
            .createMany([{ ...profileData, UserId: Id }, { ...profileData }]);

          await db.user.find(Id).update({
            profile: {
              set: { Id: profile2Id },
            },
          });

          const profile1 = await db.profile.find(profile1Id);
          expect(profile1.UserId).toBe(null);

          const profile2 = await db.profile.find(profile2Id);
          expect(profile2.UserId).toBe(Id);
        });

        it('should throw in batch update', async () => {
          expect(() =>
            db.user.where({ Id: { in: [1, 2, 3] } }).update({
              profile: {
                // @ts-expect-error not allows in batch update
                set: { Id: 1 },
              },
            }),
          ).toThrow('`set` option is not allowed in a batch update');
        });

        describe('relation callbacks', () => {
          const { beforeUpdate, afterUpdate } = useRelationCallback(
            db.user.relations.profile,
            ['Id'],
          );

          it('should invoke callbacks', async () => {
            const { Id: prevId, UserId } = await db.profile
              .select('Id', 'UserId')
              .create({ ...profileData, user: { create: userData } });

            const newId = await db.profile.get('Id').create(profileData);

            await db.user.find(UserId as number).update({
              profile: {
                set: { Id: newId },
              },
            });

            expect(beforeUpdate).toHaveBeenCalledTimes(2);
            expect(afterUpdate).toHaveBeenCalledTimes(2);
            expect(afterUpdate).toBeCalledWith(
              [{ Id: prevId }],
              expect.any(Db),
            );
            expect(afterUpdate).toBeCalledWith([{ Id: newId }], expect.any(Db));
          });
        });
      });

      describe('delete', () => {
        it('should delete related record', async () => {
          const Id = await db.user
            .get('Id')
            .create({ ...userData, profile: { create: profileData } });

          const { Id: profileId } = await db.user
            .profile({ Id })
            .select('Id')
            .take();

          await db.user.find(Id).update({
            profile: {
              delete: true,
            },
          });

          const profile = await db.profile.findByOptional({ Id: profileId });
          expect(profile).toBe(undefined);
        });

        it('should delete related record in batch update', async () => {
          const userIds = await db.user.pluck('Id').createMany([
            { ...userData, profile: { create: profileData } },
            { ...userData, profile: { create: profileData } },
          ]);

          await db.user.where({ Id: { in: userIds } }).update({
            profile: {
              delete: true,
            },
          });

          const count = await db.profile.count();
          expect(count).toBe(0);
        });

        describe('relation callbacks', () => {
          const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
            db.user.relations.profile,
            ['Id'],
          );

          it('should invoke callbacks', async () => {
            const { Id, UserId } = await db.profile
              .select('Id', 'UserId')
              .create({ ...profileData, user: { create: userData } });

            await db.user.find(UserId as number).update({
              profile: {
                delete: true,
              },
            });

            expect(beforeDelete).toHaveBeenCalledTimes(1);
            expect(afterDelete).toHaveBeenCalledTimes(1);
            expect(afterDelete).toBeCalledWith([{ Id }], expect.any(Db));
          });

          it('should invoke callbacks in a batch update', async () => {
            resetMocks();

            const data = await db.profile.select('Id', 'UserId').createMany([
              { ...profileData, user: { create: userData } },
              { ...profileData, user: { create: userData } },
            ]);

            await db.user
              .where({ Id: { in: data.map((p) => p.UserId as number) } })
              .update({
                profile: {
                  delete: true,
                },
              });

            expect(beforeDelete).toHaveBeenCalledTimes(1);
            expect(afterDelete).toHaveBeenCalledTimes(1);
            expect(afterDelete).toBeCalledWith(
              [{ Id: data[0].Id }, { Id: data[1].Id }],
              expect.any(Db),
            );
          });
        });
      });

      describe('nested update', () => {
        it('should update related record', async () => {
          const Id = await db.user
            .get('Id')
            .create({ ...userData, profile: { create: profileData } });

          await db.user.find(Id).update({
            profile: {
              update: {
                Bio: 'updated',
              },
            },
          });

          const profile = await db.user.profile({ Id }).take();
          expect(profile.Bio).toBe('updated');
        });

        it('should update related record in batch update', async () => {
          const userIds = await db.user.pluck('Id').createMany([
            { ...userData, profile: { create: profileData } },
            { ...userData, profile: { create: profileData } },
          ]);

          await db.user.where({ Id: { in: userIds } }).update({
            profile: {
              update: {
                Bio: 'updated',
              },
            },
          });

          const bios = await db.profile.pluck('Bio');
          expect(bios).toEqual(['updated', 'updated']);
        });

        describe('relation callbacks', () => {
          const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
            db.user.relations.profile,
            ['Id'],
          );

          it('should invoke callbacks', async () => {
            const { Id, UserId } = await db.profile
              .select('Id', 'UserId')
              .create({ ...profileData, user: { create: userData } });

            await db.user.find(UserId as number).update({
              profile: {
                update: {
                  Bio: 'updated',
                },
              },
            });

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toBeCalledWith([{ Id }], expect.any(Db));
          });

          it('should invoke callbacks in a batch update', async () => {
            resetMocks();

            const data = await db.profile.select('Id', 'UserId').createMany([
              { ...profileData, user: { create: userData } },
              { ...profileData, user: { create: userData } },
            ]);

            await db.user
              .where({ Id: { in: data.map((p) => p.UserId as number) } })
              .update({
                profile: {
                  update: {
                    Bio: 'updated',
                  },
                },
              });

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toBeCalledWith(
              [{ Id: data[0].Id }, { Id: data[1].Id }],
              expect.any(Db),
            );
          });
        });
      });

      describe('nested upsert', () => {
        it('should update related record if it exists', async () => {
          const user = await db.user.create({
            ...userData,
            profile: { create: profileData },
          });

          await db.user.find(user.Id).update({
            profile: {
              upsert: {
                update: {
                  Bio: 'updated',
                },
                create: profileData,
              },
            },
          });

          const profile = await db.user.profile(user);
          expect(profile.Bio).toBe('updated');
        });

        it('should create related record if it does not exists', async () => {
          const user = await db.user.create(userData);

          await db.user.find(user.Id).update({
            profile: {
              upsert: {
                update: {
                  Bio: 'updated',
                },
                create: {
                  ...profileData,
                  Bio: 'created',
                },
              },
            },
          });

          const profile = await db.user.profile(user);
          expect(profile.Bio).toBe('created');
        });

        it('should create related record if it does not exists with a data from a callback', async () => {
          const user = await db.user.create(userData);

          await db.user.find(user.Id).update({
            profile: {
              upsert: {
                update: {
                  Bio: 'updated',
                },
                create: () => ({
                  ...profileData,
                  Bio: 'created',
                }),
              },
            },
          });

          const profile = await db.user.profile(user);
          expect(profile.Bio).toBe('created');
        });

        it('should throw in batch update', async () => {
          expect(() =>
            db.user.where({ Id: { in: [1, 2, 3] } }).update({
              profile: {
                // @ts-expect-error not allows in batch update
                upsert: {
                  update: {
                    Bio: 'updated',
                  },
                  create: {
                    ...profileData,
                    Bio: 'created',
                  },
                },
              },
            }),
          ).toThrow('`upsert` option is not allowed in a batch update');
        });

        describe('relation callbacks', () => {
          const {
            beforeUpdate,
            afterUpdate,
            beforeCreate,
            afterCreate,
            resetMocks,
          } = useRelationCallback(db.user.relations.profile, ['Id']);

          it('should invoke callbacks when connecting', async () => {
            const { Id, UserId } = await db.profile
              .select('Id', 'UserId')
              .create({ ...profileData, user: { create: userData } });

            await db.user.find(UserId as number).update({
              profile: {
                upsert: {
                  update: {
                    Bio: 'updated',
                  },
                  create: profileData,
                },
              },
            });

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toBeCalledWith(
              [{ Id, UserId }],
              expect.any(Db),
            );
          });

          it('should invoke callbacks when creating', async () => {
            resetMocks();

            const userId = await db.user.get('Id').create(userData);

            await db.user.find(userId).update({
              profile: {
                upsert: {
                  update: {
                    Bio: 'updated',
                  },
                  create: profileData,
                },
              },
            });

            const profile = await db.profile.take();

            expect(beforeCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toHaveBeenCalledWith([profile], expect.any(Db));
          });
        });
      });

      describe('nested create', () => {
        it('should create new related record', async () => {
          const userId = await db.user
            .get('Id')
            .create({ ...userData, profile: { create: profileData } });

          const previousProfileId = await db.user
            .profile({ Id: userId })
            .get('Id');

          const updated = await db.user
            .selectAll()
            .find(userId)
            .update({
              profile: {
                create: { ...profileData, Bio: 'created' },
              },
            });

          const previousProfile = await db.profile.find(previousProfileId);
          expect(previousProfile.UserId).toBe(null);

          const profile = await db.user.profile(updated);
          expect(profile.Bio).toBe('created');
        });

        it('should throw in batch update', async () => {
          expect(() =>
            db.user.where({ Id: { in: [1, 2, 3] } }).update({
              profile: {
                // @ts-expect-error not allows in batch update
                create: {
                  ...profileData,
                  Bio: 'created',
                },
              },
            }),
          ).toThrow('`create` option is not allowed in a batch update');
        });

        describe('relation callbacks', () => {
          const {
            beforeUpdate,
            afterUpdate,
            beforeCreate,
            afterCreate,
            resetMocks,
          } = useRelationCallback(db.user.relations.profile, ['Id']);

          it('should invoke callbacks to disconnect previous and create new', async () => {
            const { Id, UserId } = await db.profile
              .select('Id', 'UserId')
              .create({ ...profileData, user: { create: userData } });

            resetMocks();

            await db.user.find(UserId as number).update({
              profile: {
                create: profileData,
              },
            });

            expect(beforeUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledTimes(1);
            expect(afterUpdate).toHaveBeenCalledWith([{ Id }], expect.any(Db));

            const newId = await db.profile.findBy({ UserId }).get('Id');

            expect(beforeCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toHaveBeenCalledTimes(1);
            expect(afterCreate).toBeCalledWith([{ Id: newId }], expect.any(Db));
          });
        });
      });
    });
  });

  describe('not required hasOne', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        Name: t.name('name').text(),
        Password: t.name('password').text(),
      }));

      relations = {
        profile: this.hasOne(() => ProfileTable, {
          primaryKey: 'Id',
          foreignKey: 'UserId',
        }),
      };
    }

    class ProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('userId').integer(),
      }));
    }

    const local = orchidORM(
      {
        db: db.$queryBuilder,
      },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    it('should query related record and get an `undefined`', async () => {
      const profile = await local.user.profile({ Id: 123 });
      expect(profile).toBe(undefined);
    });

    it('should be selectable', async () => {
      const id = await local.user.get('Id').create(userData);

      const result = await local.user.select('Id', {
        profile: (q) => q.profile,
      });

      expect(result).toEqual([
        {
          Id: id,
          profile: null,
        },
      ]);
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.user.where((q) =>
      q.profile.whereIn('Bio', ['a', 'b']).count().equals(1),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${userSelectAll} FROM "user" WHERE (
          SELECT count(*) = $1
          FROM "profile"
          WHERE "profile"."userId" = "user"."id"
            AND "profile"."bio" IN ($2, $3)
        )
      `,
      [1, 'a', 'b'],
    );
  });
});

describe('hasOne through', () => {
  it('should resolve recursive situation when both tables depends on each other', () => {
    class Post extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));

      relations = {
        postTag: this.hasOne(() => PostTag, {
          primaryKey: 'Id',
          foreignKey: 'PostId',
        }),

        tag: this.hasOne(() => Tag, {
          through: 'postTag',
          source: 'tag',
        }),
      };
    }

    class Tag extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));

      relations = {
        postTag: this.hasOne(() => PostTag, {
          primaryKey: 'Id',
          foreignKey: 'PostId',
        }),

        post: this.hasOne(() => Post, {
          through: 'postTag',
          source: 'post',
        }),
      };
    }

    class PostTag extends BaseTable {
      table = 'postTag';
      columns = this.setColumns((t) => ({
        PostId: t
          .name('postId')
          .integer()
          .foreignKey(() => Post, 'Id'),
        TagId: t
          .name('tagId')
          .integer()
          .foreignKey(() => Tag, 'Id'),
        ...t.primaryKey(['PostId', 'TagId']),
      }));

      relations = {
        post: this.belongsTo(() => Post, {
          primaryKey: 'Id',
          foreignKey: 'PostId',
        }),

        tag: this.belongsTo(() => Tag, {
          primaryKey: 'Id',
          foreignKey: 'TagId',
        }),
      };
    }

    const local = orchidORM(
      {
        db: db.$queryBuilder,
        log: false,
      },
      {
        post: Post,
        tag: Tag,
        postTag: PostTag,
      },
    );

    expect(Object.keys(local.post.relations)).toEqual(['postTag', 'tag']);
    expect(Object.keys(local.tag.relations)).toEqual(['postTag', 'post']);
  });

  it('should throw if through relation is not defined', () => {
    class Post extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));

      relations = {
        tag: this.hasOne(() => Tag, {
          through: 'postTag',
          source: 'tag',
        }),
      };
    }

    class Tag extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));
    }

    expect(() => {
      orchidORM(
        {
          db: db.$queryBuilder,
          log: false,
        },
        {
          post: Post,
          tag: Tag,
        },
      );
    }).toThrow(
      'Cannot define a `tag` relation on `post`: cannot find `postTag` relation required by the `through` option',
    );
  });

  it('should throw if source relation is not defined', () => {
    class Post extends BaseTable {
      table = 'post';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));

      relations = {
        postTag: this.hasOne(() => PostTag, {
          primaryKey: 'Id',
          foreignKey: 'PostId',
        }),

        tag: this.hasOne(() => Tag, {
          through: 'postTag',
          source: 'tag',
        }),
      };
    }

    class Tag extends BaseTable {
      table = 'tag';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));
    }

    class PostTag extends BaseTable {
      table = 'postTag';
      columns = this.setColumns((t) => ({
        PostId: t
          .name('postId')
          .integer()
          .foreignKey(() => Post, 'Id'),
        TagId: t
          .name('tagId')
          .integer()
          .foreignKey(() => Tag, 'Id'),
        ...t.primaryKey(['PostId', 'TagId']),
      }));
    }

    expect(() => {
      orchidORM(
        {
          db: db.$queryBuilder,
          log: false,
        },
        {
          post: Post,
          tag: Tag,
          postTag: PostTag,
        },
      );
    }).toThrow(
      'Cannot define a `tag` relation on `post`: cannot find `tag` relation in `postTag` required by the `source` option',
    );
  });

  it('should have method to query related data', async () => {
    const query = db.message.profile({ AuthorId: 1 });
    expectSql(
      query.toSQL(),
      `
        SELECT ${profileSelectAll} FROM "profile"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "profile"."userId" = "user"."id"
            AND "user"."id" = $1
        )
      `,
      [1],
    );
  });

  it('should handle chained query', () => {
    const query = db.message
      .where({ Text: 'text' })
      .profile.where({ Bio: 'bio' });

    expectSql(
      query.toSQL(),
      `
        SELECT ${profileSelectAll} FROM "profile"
        WHERE EXISTS (
            SELECT 1 FROM "message"
            WHERE "message"."text" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE "profile"."userId" = "user"."id"
                  AND "user"."id" = "message"."authorId"
              )
          )
          AND "profile"."bio" = $2
      `,
      ['text', 'bio'],
    );
  });

  it('should have disabled create method', () => {
    // @ts-expect-error hasOne with through option should not have chained create
    db.message.profile.create(chatData);
  });

  it('should have chained delete method', () => {
    const query = db.message
      .where({ Text: 'text' })
      .profile.where({ Bio: 'bio' })
      .delete();

    expectSql(
      query.toSQL(),
      `
        DELETE FROM "profile"
        WHERE EXISTS (
            SELECT 1 FROM "message"
            WHERE "message"."text" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE "profile"."userId" = "user"."id"
                  AND "user"."id" = "message"."authorId"
              )
          )
          AND "profile"."bio" = $2
      `,
      ['text', 'bio'],
    );
  });

  it('should have proper joinQuery', () => {
    expectSql(
      db.message.relations.profile.relationConfig
        .joinQuery(db.message.as('m'), db.profile.as('p'))
        .toSQL(),
      `
        SELECT ${profileSelectAll} FROM "profile" AS "p"
        WHERE EXISTS (
          SELECT 1 FROM "user"
          WHERE "p"."userId" = "user"."id"
            AND "user"."id" = "m"."authorId"
        )
      `,
    );
  });

  it('should be supported in whereExists', () => {
    expectSql(
      db.message.whereExists('profile').toSQL(),
      `
        SELECT ${messageSelectAll} FROM "message"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
          )
        )
      `,
    );

    expectSql(
      db.message
        .as('m')
        .whereExists('profile', (q) => q.where({ Bio: 'bio' }))
        .toSQL(),
      `
        SELECT ${messageSelectAll} FROM "message" AS "m"
        WHERE EXISTS (
          SELECT 1 FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "m"."authorId"
          )
          AND "profile"."bio" = $1
        )
      `,
      ['bio'],
    );
  });

  it('should be supported in join', () => {
    const query = db.message
      .as('m')
      .join('profile', (q) => q.where({ Bio: 'bio' }))
      .select('Text', 'profile.Bio');

    assertType<Awaited<typeof query>, { Text: string; Bio: string | null }[]>();

    expectSql(
      query.toSQL(),
      `
        SELECT "m"."text" AS "Text", "profile"."bio" AS "Bio"
        FROM "message" AS "m"
        JOIN "profile"
          ON EXISTS (
            SELECT 1 FROM "user"
            WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "m"."authorId"
          )
          AND "profile"."bio" = $1
      `,
      ['bio'],
    );
  });

  it('should be supported in join with a callback', () => {
    const query = db.message
      .as('m')
      .join(
        (q) => q.profile.as('p').where({ UserId: 123 }),
        (q) => q.where({ Bio: 'bio' }),
      )
      .select('Text', 'p.Bio');

    assertType<Awaited<typeof query>, { Text: string; Bio: string | null }[]>();

    expectSql(
      query.toSQL(),
      `
        SELECT "m"."text" AS "Text", "p"."bio" AS "Bio"
        FROM "message" AS "m"
        JOIN "profile" AS "p"
          ON "p"."bio" = $1
         AND "p"."userId" = $2
         AND EXISTS (
            SELECT 1 FROM "user"
            WHERE "p"."userId" = "user"."id"
              AND "user"."id" = "m"."authorId"
          )
      `,
      ['bio', 123],
    );
  });

  it('should be supported in joinLateral', () => {
    const q = db.message
      .joinLateral('profile', (q) => q.as('p').where({ Bio: 'one' }))
      .where({ 'p.Bio': 'two' })
      .select('Text', 'p.*');

    assertType<Awaited<typeof q>, { Text: string; p: Profile }[]>();

    expectSql(
      q.toSQL(),
      `
        SELECT "message"."text" AS "Text", row_to_json("p".*) "p"
        FROM "message"
        JOIN LATERAL (
          SELECT ${profileSelectAll}
          FROM "profile" AS "p"
          WHERE "p"."bio" = $1
            AND EXISTS (
            SELECT 1
            FROM "user"
            WHERE "p"."userId" = "user"."id"
              AND "user"."id" = "message"."authorId"
          )
        ) "p" ON true
        WHERE "p"."Bio" = $2
      `,
      ['one', 'two'],
    );
  });

  describe('select', () => {
    it('should be selectable', () => {
      const query = db.message.as('m').select('Id', {
        profile: (q) => q.profile.where({ Bio: 'bio' }),
      });

      assertType<Awaited<typeof query>, { Id: number; profile: Profile }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT
            "m"."id" AS "Id",
            row_to_json("profile".*) "profile"
          FROM "message" AS "m"
          LEFT JOIN LATERAL (
            SELECT ${profileSelectAll} FROM "profile"
            WHERE "profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user"
                WHERE "profile"."userId" = "user"."id"
                AND "user"."id" = "m"."authorId"
              )
          ) "profile" ON true
        `,
        ['bio'],
      );
    });

    it('should handle exists sub query', () => {
      const query = db.message.as('m').select('Id', {
        hasProfile: (q) => q.profile.exists(),
      });

      assertType<
        Awaited<typeof query>,
        { Id: number; hasProfile: boolean }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT
            "m"."id" AS "Id",
            COALESCE("hasProfile".r, false) "hasProfile"
          FROM "message" AS "m"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "profile"
            WHERE EXISTS (
              SELECT 1 FROM "user"
              WHERE "profile"."userId" = "user"."id"
              AND "user"."id" = "m"."authorId"
            )
          ) "hasProfile" ON true
        `,
      );
    });

    it('should support recurring select', async () => {
      const q = db.message.select({
        profile: (q) =>
          q.profile.select({
            messages: (q) =>
              q.messages
                .select({
                  profile: (q) => q.profile,
                })
                .where({ 'profile.Bio': 'bio' }),
          }),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("profile".*) "profile"
          FROM "message"
          LEFT JOIN LATERAL (
            SELECT COALESCE("messages".r, '[]') "messages"
            FROM "profile"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json("t".*)) r
              FROM (
                SELECT row_to_json("profile2".*) "profile"
                FROM "message" AS "messages"
                LEFT JOIN LATERAL (
                  SELECT ${profileSelectAll}
                  FROM "profile"
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE "profile"."userId" = "user"."id"
                      AND "user"."id" = "messages"."authorId"
                  )
                ) "profile2" ON true
                WHERE "profile2"."Bio" = $1
                  AND EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE "messages"."authorId" = "user"."id"
                      AND "user"."id" = "profile"."userId"
                  )
              ) AS "t"
            ) "messages" ON true
            WHERE EXISTS (
              SELECT 1
              FROM "user"
              WHERE "profile"."userId" = "user"."id"
                AND "user"."id" = "message"."authorId"
            )
          ) "profile" ON true
        `,
        ['bio'],
      );
    });
  });

  describe('not required hasOne through', () => {
    class UserTable extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        Name: t.name('name').text(),
        Password: t.name('password').text(),
      }));

      relations = {
        profile: this.hasOne(() => ProfileTable, {
          primaryKey: 'Id',
          foreignKey: 'UserId',
        }),
      };
    }

    class ProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('userId').integer().nullable(),
      }));
    }

    class MessageTable extends BaseTable {
      readonly table = 'message';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        ChatId: t.name('chatId').integer(),
        AuthorId: t.name('authorId').integer().nullable(),
        Text: t.name('text').text(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          primaryKey: 'Id',
          foreignKey: 'AuthorId',
        }),

        profile: this.hasOne(() => ProfileTable, {
          through: 'user',
          source: 'profile',
        }),
      };
    }

    const local = orchidORM(
      {
        db: db.$queryBuilder,
      },
      {
        user: UserTable,
        profile: ProfileTable,
        message: MessageTable,
      },
    );

    it('should query related record and get an `undefined`', async () => {
      const profile = await local.message.profile({ AuthorId: 123 });
      expect(profile).toBe(undefined);
    });

    it('should be selectable', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(chatData);
      const id = await local.message
        .get('Id')
        .create({ ...messageData, ChatId });

      const result = await local.message.select('Id', {
        profile: (q) => q.profile,
      });

      expect(result).toEqual([
        {
          Id: id,
          profile: null,
        },
      ]);
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.message.where((q) =>
      q.profile.whereIn('Bio', ['a', 'b']).count().equals(1),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${messageSelectAll} FROM "message" WHERE (
          SELECT count(*) = $1
          FROM "profile"
          WHERE
            EXISTS (
              SELECT 1
              FROM "user"
              WHERE "profile"."userId" = "user"."id"
                AND "user"."id" = "message"."authorId"
            )
            AND "profile"."bio" IN ($2, $3)
        )
      `,
      [1, 'a', 'b'],
    );
  });
});
