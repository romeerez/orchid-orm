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
  userRowToJSON,
} from '../test-utils/orm.test-utils';
import { Db, NotFoundError, Query } from 'pqb';
import { orchidORM } from '../orm';
import { assertType, expectSql } from 'test-utils';
import { omit } from 'orchid-core';
import { createBaseTable } from '../baseTable';

const ormParams = {
  db: db.$queryBuilder,
};

useTestORM();

const activeProfileData = { ...profileData, Active: true };

describe('hasOne', () => {
  it('should define foreign keys under autoForeignKeys option', () => {
    const BaseTable = createBaseTable({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    class UserTable extends BaseTable {
      table = 'user';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
      }));

      relations = {
        user: this.hasOne(() => ProfileTable, {
          columns: ['Id'],
          references: ['UserId'],
        }),
        user2: this.hasOne(() => ProfileTable, {
          columns: ['Id'],
          references: ['UserId2'],
          foreignKey: false,
        }),
        user3: this.hasOne(() => ProfileTable, {
          columns: ['Id'],
          references: ['UserId3'],
          foreignKey: {
            onDelete: 'CASCADE',
          },
        }),
      };
    }

    class ProfileTable extends BaseTable {
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('user_id').integer(),
        UserId2: t.name('user_id_2').integer(),
        UserId3: t.name('user_id_3').integer(),
      }));
    }

    const db = orchidORM(ormParams, { user: UserTable, profile: ProfileTable });
    expect(db.profile.internal.tableData.constraints).toEqual([
      {
        references: {
          columns: ['UserId'],
          fnOrTable: 'user',
          foreignColumns: ['Id'],
          options: { onUpdate: 'CASCADE' },
        },
      },
      {
        references: {
          columns: ['UserId3'],
          fnOrTable: 'user',
          foreignColumns: ['Id'],
          options: { onDelete: 'CASCADE' },
        },
      },
    ]);
  });

  describe('querying', () => {
    describe('queryRelated', () => {
      it('should support `queryRelated` to query related data', async () => {
        const UserId = await db.user.get('Id').create(userData);
        await db.profile.create({ ...profileData, UserId });
        const user = await db.user.find(UserId);

        const query = db.user.queryRelated('profile', user);

        expectSql(
          query.toSQL(),
          `
            SELECT ${profileSelectAll} FROM "profile"
            WHERE "profile"."user_id" = $1
              AND "profile"."profile_key" = $2
          `,
          [UserId, 'key'],
        );

        const profile = await query;

        expect(profile).toMatchObject(profileData);
      });

      it('should query related data using `on`', async () => {
        const UserId = await db.user.get('Id').create(userData);
        await db.profile.create({ ...activeProfileData, UserId });
        const user = await db.user.find(UserId);

        const query = db.user.queryRelated('activeProfile', user);

        expectSql(
          query.toSQL(),
          `
            SELECT ${profileSelectAll} FROM "profile" "activeProfile"
            WHERE "activeProfile"."active" = $1
              AND "activeProfile"."user_id" = $2
              AND "activeProfile"."profile_key" = $3
          `,
          [true, UserId, 'key'],
        );

        const profile = await query;
        expect(profile).toMatchObject(profileData);
      });

      it('should create with defaults of provided id', () => {
        const user = { Id: 1, UserKey: 'key' };
        const now = new Date();

        const query = db.user.queryRelated('profile', user).insert({
          Bio: 'bio',
          updatedAt: now,
          createdAt: now,
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "profile"("user_id", "profile_key", "bio", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5)
          `,
          [1, 'key', 'bio', now, now],
        );
      });

      it('should create with defaults of provided id using `on`', () => {
        const user = { Id: 1, UserKey: 'key' };
        const now = new Date();

        const query = db.user.queryRelated('activeProfile', user).insert({
          Bio: 'bio',
          updatedAt: now,
          createdAt: now,
        });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "profile"("active", "user_id", "profile_key", "bio", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [true, 1, 'key', 'bio', now, now],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.user.relations.profile.relationConfig.joinQuery(
            db.profile.as('p'),
            db.user.as('u'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "p"
          WHERE "p"."user_id" = "u"."id"
            AND "p"."profile_key" = "u"."user_key"
        `,
      );
    });

    describe('whereExists', () => {
      it('should be supported in whereExists', () => {
        expectSql(
          db.user.as('u').whereExists('profile').toSQL(),
          `
          SELECT ${userSelectAll} FROM "user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "profile"
            WHERE "profile"."user_id" = "u"."id"
            AND "profile"."profile_key" = "u"."user_key"
          )
        `,
        );

        expectSql(
          db.user
            .as('u')
            .whereExists((q) => q.profile.where({ Bio: 'bio' }))
            .toSQL(),
          `
              SELECT ${userSelectAll} FROM "user" "u"
              WHERE EXISTS (
                SELECT 1 FROM "profile"
                WHERE "profile"."bio" = $1
                  AND "profile"."user_id" = "u"."id"
                  AND "profile"."profile_key" = "u"."user_key"
              )
            `,
          ['bio'],
        );

        expectSql(
          db.user
            .as('u')
            .whereExists('profile', (q) => q.where({ 'profile.Bio': 'bio' }))
            .toSQL(),
          `
            SELECT ${userSelectAll} FROM "user" "u"
            WHERE EXISTS (
              SELECT 1 FROM "profile"
              WHERE "profile"."user_id" = "u"."id"
                AND "profile"."profile_key" = "u"."user_key"
                AND "profile"."bio" = $1
            )
          `,
          ['bio'],
        );
      });

      it('should be supported in whereExists using `on`', () => {
        expectSql(
          db.user.as('u').whereExists('activeProfile').toSQL(),
          `
            SELECT ${userSelectAll} FROM "user" "u"
            WHERE EXISTS (
              SELECT 1 FROM "profile"  "activeProfile"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "u"."id"
                AND "activeProfile"."profile_key" = "u"."user_key"
            )
          `,
          [true],
        );

        expectSql(
          db.user
            .as('u')
            .whereExists((q) => q.activeProfile.where({ Bio: 'bio' }))
            .toSQL(),
          `
              SELECT ${userSelectAll} FROM "user" "u"
              WHERE EXISTS (
                SELECT 1 FROM "profile"  "activeProfile"
                WHERE "activeProfile"."active" = $1
                  AND "activeProfile"."bio" = $2
                  AND "activeProfile"."user_id" = "u"."id"
                  AND "activeProfile"."profile_key" = "u"."user_key"
              )
            `,
          [true, 'bio'],
        );

        expectSql(
          db.user
            .as('u')
            .whereExists('activeProfile', (q) =>
              q.where({ 'activeProfile.Bio': 'bio' }),
            )
            .toSQL(),
          `
            SELECT ${userSelectAll} FROM "user" "u"
            WHERE EXISTS (
              SELECT 1 FROM "profile"  "activeProfile"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "u"."id"
                AND "activeProfile"."profile_key" = "u"."user_key"
                AND "activeProfile"."bio" = $2
            )
          `,
          [true, 'bio'],
        );
      });
    });

    describe('join', () => {
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
          SELECT "u"."name" "Name", "profile"."bio" "Bio"
          FROM "user" "u"
          JOIN "profile"
            ON "profile"."user_id" = "u"."id"
                 AND "profile"."profile_key" = "u"."user_key"
           AND "profile"."bio" = $1
        `,
          ['bio'],
        );
      });

      it('should be supported in join using `on`', () => {
        const query = db.user
          .as('u')
          .join('activeProfile', (q) => q.where({ Bio: 'bio' }))
          .select('Name', 'activeProfile.Bio');

        assertType<
          Awaited<typeof query>,
          { Name: string; Bio: string | null }[]
        >();

        expectSql(
          query.toSQL(),
          `
            SELECT "u"."name" "Name", "activeProfile"."bio" "Bio"
            FROM "user" "u"
            JOIN "profile"  "activeProfile"
              ON "activeProfile"."active" = $1
             AND "activeProfile"."user_id" = "u"."id"
             AND "activeProfile"."profile_key" = "u"."user_key"
             AND "activeProfile"."bio" = $2
          `,
          [true, 'bio'],
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
          SELECT "u"."name" "Name", "p"."bio" "Bio"
          FROM "user" "u"
          JOIN "profile"  "p"
            ON "p"."bio" = $1
            AND "p"."user_id" = $2
            AND "p"."user_id" = "u"."id"
            AND "p"."profile_key" = "u"."user_key"
        `,
          ['bio', 123],
        );
      });

      it('should be supported in join with a callback', () => {
        const query = db.user
          .as('u')
          .join(
            (q) => q.activeProfile.as('p').where({ UserId: 123 }),
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
            SELECT "u"."name" "Name", "p"."bio" "Bio"
            FROM "user" "u"
            JOIN "profile"  "p"
              ON "p"."bio" = $1
             AND "p"."active" = $2
             AND "p"."user_id" = $3
             AND "p"."user_id" = "u"."id"
             AND "p"."profile_key" = "u"."user_key"
          `,
          ['bio', true, 123],
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
            SELECT "user"."name" "Name", row_to_json("p".*) "p"
            FROM "user"
            JOIN LATERAL (
              SELECT ${profileSelectAll}
              FROM "profile" "p"
              WHERE "p"."bio" = $1
                AND "p"."user_id" = "user"."id"
                AND "p"."profile_key" = "user"."user_key"
            ) "p" ON true
            WHERE "p"."Bio" = $2
          `,
          ['one', 'two'],
        );
      });

      it('should be supported in joinLateral', () => {
        const q = db.user
          .joinLateral('activeProfile', (q) => q.as('p').where({ Bio: 'one' }))
          .where({ 'p.Bio': 'two' })
          .select('Name', 'p.*');

        assertType<Awaited<typeof q>, { Name: string; p: Profile }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."name" "Name", row_to_json("p".*) "p"
            FROM "user"
            JOIN LATERAL (
              SELECT ${profileSelectAll}
              FROM "profile" "p"
              WHERE "p"."active" = $1
                AND "p"."bio" = $2
                AND "p"."user_id" = "user"."id"
                AND "p"."profile_key" = "user"."user_key"
            ) "p" ON true
            WHERE "p"."Bio" = $3
          `,
          [true, 'one', 'two'],
        );
      });
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
              "u"."id" "Id",
              row_to_json("profile".*) "profile"
            FROM "user" "u"
            LEFT JOIN LATERAL (
              SELECT ${profileSelectAll}
              FROM "profile"
              WHERE "profile"."bio" = $1
                AND "profile"."user_id" = "u"."id"
                AND "profile"."profile_key" = "u"."user_key"
            ) "profile" ON true
            ORDER BY "profile"."Bio" ASC
          `,
          ['bio'],
        );
      });

      it('should be selectable using `on`', () => {
        const query = db.user
          .as('u')
          .select('Id', {
            profile: (q) => q.activeProfile.where({ Bio: 'bio' }),
          })
          .order('profile.Bio');

        assertType<Awaited<typeof query>, { Id: number; profile: Profile }[]>();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              row_to_json("profile".*) "profile"
            FROM "user" "u"
                   LEFT JOIN LATERAL (
              SELECT ${profileSelectAll}
              FROM "profile" "activeProfile"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."bio" = $2
                AND "activeProfile"."user_id" = "u"."id"
                AND "activeProfile"."profile_key" = "u"."user_key"
              ) "profile" ON true
            ORDER BY "profile"."Bio" ASC
          `,
          [true, 'bio'],
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
              "u"."id" "Id",
              COALESCE("hasProfile".r, false) "hasProfile"
            FROM "user" "u"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "profile"
              WHERE "profile"."user_id" = "u"."id"
                AND "profile"."profile_key" = "u"."user_key"
            ) "hasProfile" ON true
          `,
        );
      });

      it('should handle exists sub query using `on`', () => {
        const query = db.user.as('u').select('Id', {
          hasProfile: (q) => q.activeProfile.exists(),
        });

        assertType<
          Awaited<typeof query>,
          { Id: number; hasProfile: boolean }[]
        >();

        expectSql(
          query.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              COALESCE("hasProfile".r, false) "hasProfile"
            FROM "user" "u"
            LEFT JOIN LATERAL (
              SELECT true r
              FROM "profile" "activeProfile"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "u"."id"
                AND "activeProfile"."profile_key" = "u"."user_key"
            ) "hasProfile" ON true
          `,
          [true],
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
              SELECT ${userRowToJSON('user2')} "user"
              FROM "profile"
              LEFT JOIN LATERAL (
                SELECT row_to_json("profile2".*) "profile"
                FROM "user" "user2"
                LEFT JOIN LATERAL (
                  SELECT ${profileSelectAll}
                  FROM "profile" "profile2"
                  WHERE "profile2"."user_id" = "user2"."id"
                    AND "profile2"."profile_key" = "user2"."user_key"
                ) "profile2" ON true
                WHERE "profile2"."Bio" = $1
                  AND "user2"."id" = "profile"."user_id"
                  AND "user2"."user_key" = "profile"."profile_key"
              ) "user2" ON true
              WHERE "profile"."user_id" = "user"."id"
                AND "profile"."profile_key" = "user"."user_key"
            ) "profile" ON true
          `,
          ['bio'],
        );
      });

      it('should support recurring select', () => {
        const q = db.user.as('activeUser').select({
          activeProfile: (q) =>
            q.activeProfile.select({
              activeUser: (q) =>
                q.activeUser
                  .select({
                    activeProfile: (q) => q.activeProfile,
                  })
                  .where({ 'activeProfile.Bio': 'bio' }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT row_to_json("activeProfile".*) "activeProfile"
            FROM "user" "activeUser"
            LEFT JOIN LATERAL (
              SELECT ${userRowToJSON('activeUser2')} "activeUser"
              FROM "profile" "activeProfile"
              LEFT JOIN LATERAL (
                SELECT row_to_json("activeProfile2".*) "activeProfile"
                FROM "user" "activeUser2"
                LEFT JOIN LATERAL (
                  SELECT ${profileSelectAll}
                  FROM "profile" "activeProfile2"
                  WHERE "activeProfile2"."active" = $1
                    AND "activeProfile2"."user_id" = "activeUser2"."id"
                    AND "activeProfile2"."profile_key" = "activeUser2"."user_key"
                ) "activeProfile2" ON true
                WHERE "activeUser2"."active" = $2
                  AND "activeProfile2"."Bio" = $3
                  AND "activeUser2"."id" = "activeProfile"."user_id"
                  AND "activeUser2"."user_key" = "activeProfile"."profile_key"
              ) "activeUser2" ON true
              WHERE "activeProfile"."active" = $4
                AND "activeProfile"."user_id" = "activeUser"."id"
                AND "activeProfile"."profile_key" = "activeUser"."user_key"
            ) "activeProfile" ON true
          `,
          [true, true, 'bio', true],
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
                SELECT "user"."name"
                FROM "user"
                WHERE "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              ),
              "updated_at" = now()
          `,
        );
      });

      it('should be selectable for update using `on`', () => {
        const q = db.profile.all().update({
          Bio: (q) => q.activeUser.get('Name'),
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "profile"
            SET
              "bio" = (
                SELECT "activeUser"."name"
                FROM "user" "activeUser"
                WHERE "activeUser"."active" = $1
                  AND "activeUser"."id" = "profile"."user_id"
                  AND "activeUser"."user_key" = "profile"."profile_key"
              ),
              "updated_at" = now()
          `,
          [true],
        );
      });
    });
  });

  describe('create', () => {
    const assert = {
      user({ user, Name }: { user: User; Name: string }) {
        expect(user).toEqual({
          ...omit(userData, ['Password']),
          Id: user.Id,
          Name,
          Active: null,
          Age: null,
          Data: null,
          Picture: null,
        });
      },

      profile({
        profile,
        Bio,
        Active,
      }: {
        profile: Profile;
        Bio: string;
        Active?: boolean;
      }) {
        expect(profile).toMatchObject({
          ...profileData,
          Id: profile.Id,
          UserId: profile.UserId,
          updatedAt: profile.updatedAt,
          createdAt: profile.createdAt,
          Bio,
          Active: Active || null,
        });
      },

      activeProfile(params: { profile: Profile; Bio: string }) {
        return this.profile({ ...params, Active: true });
      },
    };

    describe('nested create', () => {
      it('should support create', async () => {
        const q = db.user.create({
          ...userData,
          Name: 'user',
          profile: {
            create: {
              ...profileData,
              Bio: 'profile',
            },
          },
        });

        const user = await q;
        const profile = await db.profile.findBy({ UserId: user.Id });

        assert.user({ user, Name: 'user' });
        assert.profile({ profile, Bio: 'profile' });
      });

      it('should support create using `on`', async () => {
        const q = db.user.create({
          ...userData,
          Name: 'user',
          activeProfile: {
            create: {
              ...profileData,
              Bio: 'profile',
            },
          },
        });

        const user = await q;
        const profile = await db.profile.findBy({ UserId: user.Id });

        assert.user({ user, Name: 'user' });
        assert.activeProfile({ profile, Bio: 'profile' });
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

        assert.user({ user: users[0], Name: 'user 1' });
        assert.profile({ profile: profiles[0], Bio: 'profile 1' });

        assert.user({ user: users[1], Name: 'user 2' });
        assert.profile({ profile: profiles[1], Bio: 'profile 2' });
      });

      it('should create many using `on`', async () => {
        const query = db.user.createMany([
          {
            ...userData,
            Name: 'user 1',
            activeProfile: {
              create: {
                ...profileData,
                Bio: 'profile 1',
              },
            },
          },
          {
            ...userData,
            Name: 'user 2',
            activeProfile: {
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

        assert.user({ user: users[0], Name: 'user 1' });
        assert.activeProfile({ profile: profiles[0], Bio: 'profile 1' });

        assert.user({ user: users[1], Name: 'user 2' });
        assert.activeProfile({ profile: profiles[1], Bio: 'profile 2' });
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
        const profile = await db.user.queryRelated('profile', user);

        assert.user({ user, Name: 'user' });
        assert.profile({ profile, Bio: 'profile' });
      });

      it('should fail to connect when `on` condition does not match', async () => {
        await db.profile.create({
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
          activeProfile: {
            connect: { Bio: 'profile' },
          },
        });

        const res = await query.catch((err) => err);

        expect(res).toEqual(expect.any(NotFoundError));
      });

      it('should support connect in batch create', async () => {
        await db.profile.createMany([
          {
            Bio: 'profile 1',
            user: {
              create: {
                ...userData,
                Name: 'tmp',
              },
            },
          },
          {
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

        assert.user({ user: users[0], Name: 'user 1' });
        assert.profile({ profile: profiles[0], Bio: 'profile 1' });

        assert.user({ user: users[1], Name: 'user 2' });
        assert.profile({ profile: profiles[1], Bio: 'profile 2' });
      });

      it('should fail to connect when `on` condition does not match', async () => {
        await db.profile.create({
          Bio: 'profile',
          user: {
            create: {
              ...userData,
              Name: 'tmp',
            },
          },
        });

        const query = db.user.createMany([
          {
            ...userData,
            activeProfile: {
              connect: { Bio: 'profile' },
            },
          },
        ]);

        const res = await query.catch((err) => err);

        expect(res).toEqual(expect.any(NotFoundError));
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.profile,
          ['Id'],
        );

        it('should invoke callbacks', async () => {
          const profileId = await db.profile.get('Id').create(profileData);

          await db.user.insert({
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

        const profile1 = await db.user.queryRelated('profile', user1);
        const profile2 = await db.user.queryRelated('profile', user2);

        expect(profile1.Id).toBe(profileId);
        assert.user({ user: user1, Name: 'user 1' });
        assert.profile({ profile: profile1, Bio: 'profile 1' });

        assert.user({ user: user2, Name: 'user 2' });
        assert.profile({ profile: profile2, Bio: 'profile 2' });
      });

      it('should support connect or create using `on`', async () => {
        const [profile1Id, profile2Id] = await db.profile
          .pluck('Id')
          .createMany([
            {
              Bio: 'profile 1',
              Active: true,
              user: {
                create: {
                  ...userData,
                  Name: 'tmp',
                },
              },
            },
            {
              Bio: 'profile 2',
              user: {
                create: {
                  ...userData,
                  Name: 'tmp',
                },
              },
            },
          ]);

        const user1 = await db.user.create({
          ...userData,
          Name: 'user 1',
          activeProfile: {
            connectOrCreate: {
              where: { Bio: 'profile 1' },
              create: { ...profileData, Bio: 'profile 1' },
            },
          },
        });

        const user2 = await db.user.create({
          ...userData,
          Name: 'user 2',
          activeProfile: {
            connectOrCreate: {
              where: { Bio: 'profile 2' },
              create: { ...profileData, Bio: 'profile 2' },
            },
          },
        });

        const profile1 = await db.user.queryRelated('activeProfile', user1);
        const profile2 = await db.user.queryRelated('activeProfile', user2);

        expect(profile1.Id).toBe(profile1Id);
        assert.user({ user: user1, Name: 'user 1' });
        assert.activeProfile({ profile: profile1, Bio: 'profile 1' });

        expect(profile2.Id).not.toBe(profile2Id);
        assert.user({ user: user2, Name: 'user 2' });
        assert.activeProfile({ profile: profile2, Bio: 'profile 2' });
      });

      it('should support connect or create many', async () => {
        const profileId = await db.profile.get('Id').create({
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

        const profile1 = await db.user.queryRelated('profile', user1);
        const profile2 = await db.user.queryRelated('profile', user2);

        expect(profile1.Id).toBe(profileId);
        assert.user({ user: user1, Name: 'user 1' });
        assert.profile({ profile: profile1, Bio: 'profile 1' });

        assert.user({ user: user2, Name: 'user 2' });
        assert.profile({ profile: profile2, Bio: 'profile 2' });
      });

      it('should connect or create in batch create using `on`', async () => {
        const [profile1Id, profile2Id] = await db.profile
          .pluck('Id')
          .createMany([
            {
              Bio: 'profile 1',
              Active: true,
              user: {
                create: {
                  ...userData,
                  Name: 'tmp',
                },
              },
            },
            {
              Bio: 'profile 2',
              user: {
                create: {
                  ...userData,
                  Name: 'tmp',
                },
              },
            },
          ]);

        const [user1, user2] = await db.user.createMany([
          {
            ...userData,
            Name: 'user 1',
            activeProfile: {
              connectOrCreate: {
                where: { Bio: 'profile 1' },
                create: { ...profileData, Bio: 'profile 1' },
              },
            },
          },
          {
            ...userData,
            Name: 'user 2',
            activeProfile: {
              connectOrCreate: {
                where: { Bio: 'profile 2' },
                create: { ...profileData, Bio: 'profile 2' },
              },
            },
          },
        ]);

        const profile1 = await db.user.queryRelated('activeProfile', user1);
        const profile2 = await db.user.queryRelated('activeProfile', user2);

        expect(profile1.Id).toBe(profile1Id);
        assert.user({ user: user1, Name: 'user 1' });
        assert.activeProfile({ profile: profile1, Bio: 'profile 1' });

        expect(profile2.Id).not.toBe(profile2Id);
        assert.user({ user: user2, Name: 'user 2' });
        assert.activeProfile({ profile: profile2, Bio: 'profile 2' });
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
        const user = await db.user.create({
          ...userData,
          profile: { create: profileData },
        });

        const { Id: profileId } = await db.user.queryRelated('profile', user);

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

      it('should not nullify foreignKey when `on` condition does not match', async () => {
        const user = await db.user.create({
          ...userData,
          profile: { create: profileData },
        });

        const { Id: profileId } = await db.user.queryRelated('profile', user);

        const Id = await db.user
          .get('Id')
          .where(user)
          .update({
            activeProfile: {
              disconnect: true,
            },
          });

        expect(Id).toBe(user.Id);

        const profile = await db.profile.find(profileId);
        expect(profile.UserId).toBe(user.Id);
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

      it('should not nullify foreignKey in batch update when `on` condition does not match', async () => {
        const userIds = await db.user
          .pluck('Id')
          .createMany([{ ...userData, profile: { create: profileData } }]);

        const profileIds = await db.profile.pluck('Id').where({
          UserId: { in: userIds },
        });

        await db.user.where({ Id: { in: userIds } }).update({
          activeProfile: {
            disconnect: true,
          },
        });

        const updatedUserIds = await db.profile
          .pluck('UserId')
          .where({ Id: { in: profileIds } });

        expect(updatedUserIds).toEqual(userIds);
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

      it('should not nullify when `on` condition does not match, and update foreignKey of the new record', async () => {
        const Id = await db.user.get('Id').create(userData);

        const [{ Id: profile1Id }, { Id: profile2Id }] = await db.profile
          .select('Id')
          .createMany([
            { ...profileData, UserId: Id },
            { ...profileData, Active: true },
          ]);

        await db.user.find(Id).update({
          activeProfile: {
            set: { Id: profile2Id },
          },
        });

        const profile1 = await db.profile.find(profile1Id);
        expect(profile1.UserId).toBe(Id);

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
            .create({ Bio: 'bio', user: { create: userData } });

          const newId = await db.profile.get('Id').create(profileData);

          await db.user.find(UserId as number).update({
            profile: {
              set: { Id: newId },
            },
          });

          expect(beforeUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toHaveBeenCalledTimes(2);
          expect(afterUpdate).toBeCalledWith([{ Id: prevId }], expect.any(Db));
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
          .queryRelated('profile', { Id, UserKey: 'key' })
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

      it('should not delete when `on` condition does not match', async () => {
        const Id = await db.user
          .get('Id')
          .create({ ...userData, profile: { create: profileData } });

        await db.user.find(Id).update({
          activeProfile: {
            delete: true,
          },
        });

        const profiles = await db.profile;

        expect(profiles.length).toBe(1);
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

      it('should not to delete in batch update when `on` condition does not match', async () => {
        const userIds = await db.user.pluck('Id').createMany([
          { ...userData, profile: { create: profileData } },
          { ...userData, profile: { create: profileData } },
        ]);

        await db.user.where({ Id: { in: userIds } }).update({
          activeProfile: {
            delete: true,
          },
        });

        const profiles = await db.profile;

        expect(profiles.length).toBe(2);
      });

      describe('relation callbacks', () => {
        const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
          db.user.relations.profile,
          ['Id'],
        );

        it('should invoke callbacks', async () => {
          const { Id, UserId } = await db.profile
            .select('Id', 'UserId')
            .create({ Bio: 'bio', user: { create: userData } });

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
            { Bio: 'bio', user: { create: userData } },
            { Bio: 'bio', user: { create: userData } },
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

        const profile = await db.user
          .queryRelated('profile', { Id, UserKey: 'key' })
          .take();

        expect(profile.Bio).toBe('updated');
      });

      it('should not update when `on` condition does not match', async () => {
        const Id = await db.user
          .get('Id')
          .create({ ...userData, profile: { create: profileData } });

        await db.user.find(Id).update({
          activeProfile: {
            update: {
              Bio: 'updated',
            },
          },
        });

        const profile = await db.user
          .queryRelated('profile', { Id, UserKey: 'key' })
          .take();

        expect(profile.Bio).not.toBe('updated');
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

      it('should update records in batch update only where `on` condition does match', async () => {
        const userIds = await db.user.pluck('Id').createMany([
          { ...userData, profile: { create: profileData } },
          { ...userData, profile: { create: activeProfileData } },
        ]);

        await db.user.where({ Id: { in: userIds } }).update({
          activeProfile: {
            update: {
              Bio: 'updated',
            },
          },
        });

        const bios = await db.profile.pluck('Bio');
        expect(bios).toEqual(['bio', 'updated']);
      });

      describe('relation callbacks', () => {
        const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
          db.user.relations.profile,
          ['Id'],
        );

        it('should invoke callbacks', async () => {
          const { Id, UserId } = await db.profile
            .select('Id', 'UserId')
            .create({ Bio: 'bio', user: { create: userData } });

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
            { Bio: 'bio', user: { create: userData } },
            { Bio: 'bio', user: { create: userData } },
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

        const profile = await db.user.queryRelated('profile', user);
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

        const profile = await db.user.queryRelated('profile', user);
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

        const profile = await db.user.queryRelated('profile', user);
        expect(profile.Bio).toBe('created');
      });

      it('should create a related record `when` on condition does not match for the update', async () => {
        const user = await db.user.create({
          ...userData,
          profile: { create: profileData },
        });

        await db.user.find(user.Id).update({
          activeProfile: {
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

        const profile = await db.user.queryRelated('activeProfile', user);
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
            .create({ Bio: 'bio', user: { create: userData } });

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
            [{ Id, UserId, ProfileKey: 'key' }],
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
          .queryRelated('profile', { Id: userId, UserKey: 'key' })
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

        const profile = await db.user.queryRelated('profile', updated);
        expect(profile.Bio).toBe('created');
      });

      it('should create new related record using `on`', async () => {
        const userId = await db.user
          .get('Id')
          .create({ ...userData, profile: { create: profileData } });

        const previousProfileId = await db.user
          .queryRelated('profile', { Id: userId, UserKey: 'key' })
          .get('Id');

        const updated = await db.user
          .selectAll()
          .find(userId)
          .update({
            activeProfile: {
              create: { ...profileData, Bio: 'created' },
            },
          });

        const previousProfile = await db.profile.find(previousProfileId);
        expect(previousProfile.UserId).toBe(userId);

        const profile = await db.user.queryRelated('activeProfile', updated);
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
            .create({ Bio: 'bio', user: { create: userData } });

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
          columns: ['Id'],
          references: ['UserId'],
        }),
      };
    }

    class ProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('user_id').integer(),
      }));
    }

    const local = orchidORM(ormParams, {
      user: UserTable,
      profile: ProfileTable,
    });

    it('should query related record and get an `undefined`', async () => {
      const profile = await local.user.queryRelated('profile', { Id: 123 });
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
          WHERE "profile"."bio" IN ($2, $3)
            AND "profile"."user_id" = "user"."id"
            AND "profile"."profile_key" = "user"."user_key"
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
          columns: ['Id'],
          references: ['PostId'],
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
          columns: ['Id'],
          references: ['PostId'],
        }),

        post: this.hasOne(() => Post, {
          through: 'postTag',
          source: 'post',
        }),
      };
    }

    class PostTag extends BaseTable {
      table = 'postTag';
      columns = this.setColumns(
        (t) => ({
          PostId: t
            .name('postId')
            .integer()
            .foreignKey(() => Post, 'Id'),
          TagId: t
            .name('tagId')
            .integer()
            .foreignKey(() => Tag, 'Id'),
        }),
        (t) => t.primaryKey(['PostId', 'TagId']),
      );

      relations = {
        post: this.belongsTo(() => Post, {
          references: ['Id'],
          columns: ['PostId'],
        }),

        tag: this.belongsTo(() => Tag, {
          references: ['Id'],
          columns: ['TagId'],
        }),
      };
    }

    const local = orchidORM(ormParams, {
      post: Post,
      tag: Tag,
      postTag: PostTag,
    });

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
      orchidORM(ormParams, {
        post: Post,
        tag: Tag,
      });
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
          columns: ['Id'],
          references: ['PostId'],
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
      columns = this.setColumns(
        (t) => ({
          PostId: t
            .name('postId')
            .integer()
            .foreignKey(() => Post, 'Id'),
          TagId: t
            .name('tagId')
            .integer()
            .foreignKey(() => Tag, 'Id'),
        }),
        (t) => t.primaryKey(['PostId', 'TagId']),
      );
    }

    expect(() => {
      orchidORM(ormParams, {
        post: Post,
        tag: Tag,
        postTag: PostTag,
      });
    }).toThrow(
      'Cannot define a `tag` relation on `post`: cannot find `tag` relation in `postTag` required by the `source` option',
    );
  });

  describe('queryRelated', () => {
    it('should query related record', async () => {
      const query = db.message.queryRelated('profile', {
        AuthorId: 1,
        MessageKey: 'key',
      });

      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile"
          WHERE EXISTS (
            SELECT 1 FROM "user"  "sender"
            WHERE "profile"."user_id" = "sender"."id"
              AND "profile"."profile_key" = "sender"."user_key"
              AND "sender"."id" = $1
              AND "sender"."user_key" = $2
          )
        `,
        [1, 'key'],
      );
    });

    it('should query related record using `on`', async () => {
      const query = db.message.queryRelated('activeProfile', {
        AuthorId: 1,
        MessageKey: 'key',
      });

      expectSql(
        query.toSQL(),
        `
          SELECT ${profileSelectAll} FROM "profile" "activeProfile"
          WHERE EXISTS (
            SELECT 1 FROM "user"  "activeSender"
            WHERE "activeProfile"."active" = $1
              AND "activeProfile"."user_id" = "activeSender"."id"
              AND "activeProfile"."profile_key" = "activeSender"."user_key"
              AND "activeSender"."active" = $2
              AND "activeSender"."id" = $3
              AND "activeSender"."user_key" = $4
          )
        `,
        [true, true, 1, 'key'],
      );
    });
  });

  it('should have proper joinQuery', () => {
    expectSql(
      (
        db.message.relations.profile.relationConfig.joinQuery(
          db.profile.as('p'),
          db.message.as('m'),
        ) as Query
      ).toSQL(),
      `
        SELECT ${profileSelectAll} FROM "profile" "p"
        WHERE EXISTS (
          SELECT 1 FROM "user"  "sender"
          WHERE "p"."user_id" = "sender"."id"
            AND "p"."profile_key" = "sender"."user_key"
            AND "sender"."id" = "m"."author_id"
            AND "sender"."user_key" = "m"."message_key"
        )
      `,
    );
  });

  describe('whereExists', () => {
    it('should be supported in whereExists', () => {
      expectSql(
        db.message.whereExists('profile').toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message"
          WHERE (EXISTS (
            SELECT 1 FROM "profile"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "message"."author_id"
                AND "sender"."user_key" = "message"."message_key"
            )
          ))
            AND ("message"."deleted_at" IS NULL)
        `,
      );

      expectSql(
        db.message
          .as('m')
          .whereExists((q) => q.profile.where({ Bio: 'bio' }))
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "profile"
            WHERE "profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user"  "sender"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "sender"."id" = "m"."author_id"
                  AND "sender"."user_key" = "m"."message_key"
              )
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists('profile', (q) => q.where({ 'profile.Bio': 'bio' }))
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "profile"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
            AND "profile"."bio" = $1
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should be supported in whereExists using `on`', () => {
      expectSql(
        db.message.whereExists('activeProfile').toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message"
          WHERE (EXISTS (
            SELECT 1 FROM "profile"  "activeProfile"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "activeSender"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $2
                AND "activeSender"."id" = "message"."author_id"
                AND "activeSender"."user_key" = "message"."message_key"
            )
          ))
            AND ("message"."deleted_at" IS NULL)
        `,
        [true, true],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists((q) => q.activeProfile.where({ Bio: 'bio' }))
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "profile"  "activeProfile"
            WHERE "activeProfile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user"  "activeSender"
                WHERE "activeProfile"."active" = $2
                  AND "activeProfile"."user_id" = "activeSender"."id"
                  AND "activeProfile"."profile_key" = "activeSender"."user_key"
                  AND "activeSender"."active" = $3
                  AND "activeSender"."id" = "m"."author_id"
                  AND "activeSender"."user_key" = "m"."message_key"
              )
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        ['bio', true, true],
      );

      expectSql(
        db.message
          .as('m')
          .whereExists('activeProfile', (q) =>
            q.where({ 'activeProfile.Bio': 'bio' }),
          )
          .toSQL(),
        `
          SELECT ${messageSelectAll} FROM "message" "m"
          WHERE (EXISTS (
            SELECT 1 FROM "profile"  "activeProfile"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "activeSender"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $2
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
            AND "activeProfile"."bio" = $3
          ))
            AND ("m"."deleted_at" IS NULL)
        `,
        [true, true, 'bio'],
      );
    });
  });

  describe('join', () => {
    it('should be supported in join', () => {
      const query = db.message
        .as('m')
        .join('profile', (q) => q.where({ Bio: 'bio' }))
        .select('Text', 'profile.Bio');

      assertType<
        Awaited<typeof query>,
        { Text: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "m"."text" "Text", "profile"."bio" "Bio"
          FROM "message" "m"
          JOIN "profile"
            ON EXISTS (
              SELECT 1 FROM "user"  "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
            AND "profile"."bio" = $1
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should be supported in join using `on`', () => {
      const query = db.message
        .as('m')
        .join('activeProfile', (q) => q.where({ Bio: 'bio' }))
        .select('Text', 'activeProfile.Bio');

      assertType<
        Awaited<typeof query>,
        { Text: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "m"."text" "Text", "activeProfile"."bio" "Bio"
          FROM "message" "m"
          JOIN "profile"  "activeProfile"
            ON EXISTS (
              SELECT 1 FROM "user"  "activeSender"
              WHERE "activeProfile"."active" = $1
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $2
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
            AND "activeProfile"."bio" = $3
          WHERE ("m"."deleted_at" IS NULL)
        `,
        [true, true, 'bio'],
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

      assertType<
        Awaited<typeof query>,
        { Text: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "m"."text" "Text", "p"."bio" "Bio"
          FROM "message" "m"
          JOIN "profile"  "p"
            ON "p"."bio" = $1
           AND "p"."user_id" = $2
           AND EXISTS (
              SELECT 1 FROM "user"  "sender"
              WHERE "p"."user_id" = "sender"."id"
                AND "p"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio', 123],
      );
    });

    it('should be supported in join with a callback using `on`', () => {
      const query = db.message
        .as('m')
        .join(
          (q) => q.activeProfile.as('p').where({ UserId: 123 }),
          (q) => q.where({ Bio: 'bio' }),
        )
        .select('Text', 'p.Bio');

      assertType<
        Awaited<typeof query>,
        { Text: string; Bio: string | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "m"."text" "Text", "p"."bio" "Bio"
          FROM "message" "m"
          JOIN "profile"  "p"
            ON "p"."bio" = $1
           AND "p"."user_id" = $2
           AND EXISTS (
              SELECT 1 FROM "user"  "activeSender"
              WHERE "p"."active" = $3
                AND "p"."user_id" = "activeSender"."id"
                AND "p"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $4
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio', 123, true, true],
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
          SELECT "message"."text" "Text", row_to_json("p".*) "p"
          FROM "message"
          JOIN LATERAL (
            SELECT ${profileSelectAll}
            FROM "profile" "p"
            WHERE "p"."bio" = $1
              AND EXISTS (
              SELECT 1
              FROM "user"  "sender"
              WHERE "p"."user_id" = "sender"."id"
                AND "p"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "message"."author_id"
                AND "sender"."user_key" = "message"."message_key"
            )
          ) "p" ON true
          WHERE ("p"."Bio" = $2)
            AND ("message"."deleted_at" IS NULL)
        `,
        ['one', 'two'],
      );
    });

    it('should be supported in joinLateral using `on`', () => {
      const q = db.message
        .joinLateral('activeProfile', (q) => q.as('p').where({ Bio: 'one' }))
        .where({ 'p.Bio': 'two' })
        .select('Text', 'p.*');

      assertType<Awaited<typeof q>, { Text: string; p: Profile }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "message"."text" "Text", row_to_json("p".*) "p"
          FROM "message"
          JOIN LATERAL (
            SELECT ${profileSelectAll}
            FROM "profile" "p"
            WHERE "p"."bio" = $1
              AND EXISTS (
              SELECT 1
              FROM "user"  "activeSender"
              WHERE "p"."active" = $2
                AND "p"."user_id" = "activeSender"."id"
                AND "p"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $3
                AND "activeSender"."id" = "message"."author_id"
                AND "activeSender"."user_key" = "message"."message_key"
            )
          ) "p" ON true
          WHERE ("p"."Bio" = $4)
            AND ("message"."deleted_at" IS NULL)
        `,
        ['one', true, true, 'two'],
      );
    });
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
            "m"."id" "Id",
            row_to_json("profile".*) "profile"
          FROM "message" "m"
          LEFT JOIN LATERAL (
            SELECT ${profileSelectAll} FROM "profile"
            WHERE "profile"."bio" = $1
              AND EXISTS (
                SELECT 1 FROM "user"  "sender"
                WHERE "profile"."user_id" = "sender"."id"
                  AND "profile"."profile_key" = "sender"."user_key"
                  AND "sender"."id" = "m"."author_id"
                  AND "sender"."user_key" = "m"."message_key"
              )
          ) "profile" ON true
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should be selectable using `on`', () => {
      const query = db.message.as('m').select('Id', {
        profile: (q) => q.activeProfile.where({ Bio: 'bio' }),
      });

      assertType<Awaited<typeof query>, { Id: number; profile: Profile }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT
            "m"."id" "Id",
            row_to_json("profile".*) "profile"
          FROM "message" "m"
          LEFT JOIN LATERAL (
            SELECT ${profileSelectAll} FROM "profile" "activeProfile"
            WHERE "activeProfile"."bio" = $1
              AND EXISTS (
              SELECT 1 FROM "user"  "activeSender"
              WHERE "activeProfile"."active" = $2
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $3
                AND "activeSender"."id" = "m"."author_id"
                AND "activeSender"."user_key" = "m"."message_key"
            )
          ) "profile" ON true
          WHERE ("m"."deleted_at" IS NULL)
        `,
        ['bio', true, true],
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
            "m"."id" "Id",
            COALESCE("hasProfile".r, false) "hasProfile"
          FROM "message" "m"
          LEFT JOIN LATERAL (
            SELECT true r
            FROM "profile"
            WHERE EXISTS (
              SELECT 1 FROM "user"  "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "m"."author_id"
                AND "sender"."user_key" = "m"."message_key"
            )
          ) "hasProfile" ON true
          WHERE ("m"."deleted_at" IS NULL)
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
              SELECT json_agg(row_to_json(t.*)) r
              FROM (
                SELECT row_to_json("profile2".*) "profile"
                FROM "message" "messages"
                LEFT JOIN LATERAL (
                  SELECT ${profileSelectAll}
                  FROM "profile" "profile2"
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user"  "sender"
                    WHERE "profile2"."user_id" = "sender"."id"
                      AND "profile2"."profile_key" = "sender"."user_key"
                      AND "sender"."id" = "messages"."author_id"
                      AND "sender"."user_key" = "messages"."message_key"
                  )
                ) "profile2" ON true
                WHERE ("profile2"."Bio" = $1
                  AND EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE ("messages"."author_id" = "user"."id"
                      AND "messages"."message_key" = "user"."user_key")
                      AND ("messages"."deleted_at" IS NULL)
                      AND "user"."id" = "profile"."user_id"
                      AND "user"."user_key" = "profile"."profile_key"
                  )
                ) AND ("messages"."deleted_at" IS NULL)
              ) "t"
            ) "messages" ON true
            WHERE EXISTS (
              SELECT 1
              FROM "user"  "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "message"."author_id"
                AND "sender"."user_key" = "message"."message_key"
            )
          ) "profile" ON true
          WHERE ("message"."deleted_at" IS NULL)
        `,
        ['bio'],
      );
    });

    it('should support recurring select using `on`', async () => {
      const q = db.message.select({
        profile: (q) =>
          q.activeProfile.select({
            messages: (q) =>
              q.messages
                .select({
                  profile: (q) => q.activeProfile,
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
            FROM "profile" "activeProfile"
            LEFT JOIN LATERAL (
              SELECT json_agg(row_to_json(t.*)) r
              FROM (
                SELECT row_to_json("profile".*) "profile"
                FROM "message" "messages"
                LEFT JOIN LATERAL (
                  SELECT ${profileSelectAll}
                  FROM "profile" "activeProfile2"
                  WHERE EXISTS (
                    SELECT 1
                    FROM "user"  "activeSender"
                    WHERE "activeProfile2"."active" = $1
                      AND "activeProfile2"."user_id" = "activeSender"."id"
                      AND "activeProfile2"."profile_key" = "activeSender"."user_key"
                      AND "activeSender"."active" = $2
                      AND "activeSender"."id" = "messages"."author_id"
                      AND "activeSender"."user_key" = "messages"."message_key"
                  )
                ) "profile" ON true
                WHERE ("profile"."Bio" = $3
                  AND EXISTS (
                    SELECT 1
                    FROM "user"
                    WHERE ("messages"."author_id" = "user"."id"
                      AND "messages"."message_key" = "user"."user_key")
                      AND ("messages"."deleted_at" IS NULL)
                      AND "user"."id" = "activeProfile"."user_id"
                      AND "user"."user_key" = "activeProfile"."profile_key")
                ) AND ("messages"."deleted_at" IS NULL)
              ) "t"
            ) "messages" ON true
            WHERE EXISTS (
              SELECT 1
              FROM "user" "activeSender"
              WHERE "activeProfile"."active" = $4
                AND "activeProfile"."user_id" = "activeSender"."id"
                AND "activeProfile"."profile_key" = "activeSender"."user_key"
                AND "activeSender"."active" = $5
                AND "activeSender"."id" = "message"."author_id"
                AND "activeSender"."user_key" = "message"."message_key"
            )
          ) "profile" ON true
          WHERE ("message"."deleted_at" IS NULL)
        `,
        [true, true, 'bio', true, true],
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
          columns: ['Id'],
          references: ['UserId'],
        }),
      };
    }

    class ProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('user_id').integer().nullable(),
      }));
    }

    class MessageTable extends BaseTable {
      readonly table = 'message';
      columns = this.setColumns((t) => ({
        Id: t.name('id').identity().primaryKey(),
        ChatId: t.name('chat_id').integer(),
        AuthorId: t.name('author_id').integer().nullable(),
        Text: t.name('text').text(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          references: ['Id'],
          columns: ['AuthorId'],
        }),

        profile: this.hasOne(() => ProfileTable, {
          through: 'user',
          source: 'profile',
        }),
      };
    }

    const local = orchidORM(ormParams, {
      user: UserTable,
      profile: ProfileTable,
      message: MessageTable,
    });

    it('should query related record and get an `undefined`', async () => {
      const profile = await local.message.queryRelated('profile', {
        AuthorId: 123,
      });
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
        SELECT ${messageSelectAll} FROM "message" WHERE ((
          SELECT count(*) = $1
          FROM "profile"
          WHERE "profile"."bio" IN ($2, $3)
            AND EXISTS (
              SELECT 1
              FROM "user"  "sender"
              WHERE "profile"."user_id" = "sender"."id"
                AND "profile"."profile_key" = "sender"."user_key"
                AND "sender"."id" = "message"."author_id"
                AND "sender"."user_key" = "message"."message_key"
            )
        )) AND ("message"."deleted_at" IS NULL)
      `,
      [1, 'a', 'b'],
    );
  });
});
