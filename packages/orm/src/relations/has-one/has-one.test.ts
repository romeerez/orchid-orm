import { useTestORM, userRowToJSON } from '../../test-utils/orm.test-utils';
import { Query } from 'pqb';
import { orchidORMWithAdapter } from '../../orm';
import {
  Profile,
  defineTable,
  testOrchidORMWithAdapter,
  db,
  assertType,
  expectSql,
  ProfileData,
  UserData,
  UserSelectAll,
  ProfileSelectAll,
} from 'test-utils';
import { createTableFactory } from '../../orm-table/table';

const ormParams = {
  db: db.$qb,
};

useTestORM();

const activeProfileData = { ...ProfileData, Active: true };

describe('hasOne', () => {
  it('should define foreign keys under autoForeignKeys option', () => {
    const { defineTable } = createTableFactory({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    const UserTable = defineTable('user', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    })).relations((user) => ({
      user: user('Id').hasOne(() => ProfileTable('UserId')),
      user2: user('Id')
        .hasOne(() => ProfileTable('UserId2'))
        .foreignKey(false),
      user3: user('Id')
        .hasOne(() => ProfileTable('UserId3'))
        .foreignKey({ onDelete: 'CASCADE' }),
    }));

    const ProfileTable = defineTable('profile', (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserId: t.name('user_id').integer(),
      UserId2: t.name('user_id_2').integer(),
      UserId3: t.name('user_id_3').integer(),
    }));

    const db = orchidORMWithAdapter(ormParams, {
      user: UserTable,
      profile: ProfileTable,
    });
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
        const UserId = await db.user.get('Id').create(UserData);
        await db.profile.create({ ...ProfileData, UserId });
        const user = await db.user.find(UserId);

        const q = db.user.queryRelated('profile', user);

        expectSql(
          q.toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile"
            WHERE "profile"."user_id" = $1
              AND "profile"."profile_key" = $2
          `,
          [UserId, 'key'],
        );

        const profile = await q;

        expect(profile).toMatchObject(ProfileData);
      });

      it('should query related data using `on`', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        await db.profile.create({ ...activeProfileData, UserId });
        const user = await db.user.find(UserId);

        const q = db.user.queryRelated('activeProfile', user);

        expectSql(
          q.toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "activeProfile"
            WHERE "activeProfile"."active" = $1
              AND "activeProfile"."user_id" = $2
              AND "activeProfile"."profile_key" = $3
          `,
          [true, UserId, 'key'],
        );

        const profile = await q;
        expect(profile).toMatchObject(ProfileData);
      });

      it('should create with defaults of provided id', () => {
        const user = { Id: 1, UserKey: 'key' };
        const now = new Date();

        const q = db.user.queryRelated('profile', user).insert({
          Bio: 'bio',
          updatedAt: now,
          createdAt: now,
        });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."profile"("user_id", "profile_key", "bio", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5)
          `,
          [1, 'key', 'bio', now, now],
        );
      });

      it('should create with defaults of provided id using `on`', () => {
        const user = { Id: 1, UserKey: 'key' };
        const now = new Date();

        const q = db.user.queryRelated('activeProfile', user).insert({
          Bio: 'bio',
          updatedAt: now,
          createdAt: now,
        });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."profile" AS "activeProfile"("active", "user_id", "profile_key", "bio", "updated_at", "created_at")
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [true, 1, 'key', 'bio', now, now],
        );
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.user.relations.profile.joinQuery(
            db.profile.as('p'),
            db.user.as('u'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
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
          SELECT ${UserSelectAll} FROM "schema"."user" "u"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."profile"
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
              SELECT ${UserSelectAll} FROM "schema"."user" "u"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."profile"
                WHERE "Profile"."bio" = $1
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
            SELECT ${UserSelectAll} FROM "schema"."user" "u"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"
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
            SELECT ${UserSelectAll} FROM "schema"."user" "u"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile" "activeProfile"
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
              SELECT ${UserSelectAll} FROM "schema"."user" "u"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."profile" "activeProfile"
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
            SELECT ${UserSelectAll} FROM "schema"."user" "u"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile" "activeProfile"
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
        const q = db.user
          .as('u')
          .join('profile', (q) => q.where({ Bio: 'bio' }))
          .select('Name', 'profile.Bio');

        assertType<Awaited<typeof q>, { Name: string; Bio: string | null }[]>();

        expectSql(
          q.toSQL(),
          `
          SELECT "u"."name" "Name", "profile"."bio" "Bio"
          FROM "schema"."user" "u"
          JOIN "schema"."profile"
            ON "profile"."user_id" = "u"."id"
                 AND "profile"."profile_key" = "u"."user_key"
           AND "profile"."bio" = $1
        `,
          ['bio'],
        );
      });

      it('should be supported in join using `on`', () => {
        const q = db.user
          .as('u')
          .join('activeProfile', (q) => q.where({ Bio: 'bio' }))
          .select('Name', 'activeProfile.Bio');

        assertType<Awaited<typeof q>, { Name: string; Bio: string | null }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "u"."name" "Name", "activeProfile"."bio" "Bio"
            FROM "schema"."user" "u"
            JOIN "schema"."profile" "activeProfile"
              ON "activeProfile"."active" = $1
             AND "activeProfile"."user_id" = "u"."id"
             AND "activeProfile"."profile_key" = "u"."user_key"
             AND "activeProfile"."bio" = $2
          `,
          [true, 'bio'],
        );
      });

      it('should be supported in join with a callback', () => {
        const q = db.user
          .as('u')
          .join(
            (q) => q.profile.as('p').where({ UserId: 123 }),
            (q) => q.where({ Bio: 'bio' }),
          )
          .select('Name', 'p.Bio');

        assertType<Awaited<typeof q>, { Name: string; Bio: string | null }[]>();

        expectSql(
          q.toSQL(),
          `
          SELECT "u"."name" "Name", "p"."bio" "Bio"
          FROM "schema"."user" "u"
          JOIN "schema"."profile" "p"
            ON "p"."bio" = $1
            AND "p"."user_id" = $2
            AND "p"."user_id" = "u"."id"
            AND "p"."profile_key" = "u"."user_key"
        `,
          ['bio', 123],
        );
      });

      it('should be supported in join with a callback', () => {
        const q = db.user
          .as('u')
          .join(
            (q) => q.activeProfile.as('p').where({ UserId: 123 }),
            (q) => q.where({ Bio: 'bio' }),
          )
          .select('Name', 'p.Bio');

        assertType<Awaited<typeof q>, { Name: string; Bio: string | null }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "u"."name" "Name", "p"."bio" "Bio"
            FROM "schema"."user" "u"
            JOIN "schema"."profile" "p"
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
            SELECT "User"."name" "Name", row_to_json("p".*) "p"
            FROM "schema"."user" "User"
            JOIN LATERAL (
              SELECT ${ProfileSelectAll}
              FROM "schema"."profile" "p"
              WHERE "p"."bio" = $1
                AND "p"."user_id" = "User"."id"
                AND "p"."profile_key" = "User"."user_key"
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
            SELECT "User"."name" "Name", row_to_json("p".*) "p"
            FROM "schema"."user" "User"
            JOIN LATERAL (
              SELECT ${ProfileSelectAll}
              FROM "schema"."profile" "p"
              WHERE "p"."active" = $1
                AND "p"."bio" = $2
                AND "p"."user_id" = "User"."id"
                AND "p"."profile_key" = "User"."user_key"
            ) "p" ON true
            WHERE "p"."Bio" = $3
          `,
          [true, 'one', 'two'],
        );
      });
    });

    describe('select', () => {
      it('should be selectable', () => {
        const q = db.user
          .as('u')
          .select('Id', {
            profile: (q) => q.profile.where({ Bio: 'bio' }),
          })
          .order('profile.Bio');

        assertType<Awaited<typeof q>, { Id: number; profile: Profile }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              row_to_json("profile".*) "profile"
            FROM "schema"."user" "u"
            LEFT JOIN LATERAL (
              SELECT ${ProfileSelectAll}
              FROM "schema"."profile"
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
        const q = db.user
          .as('u')
          .select('Id', {
            profile: (q) => q.activeProfile.where({ Bio: 'bio' }),
          })
          .order('profile.Bio');

        assertType<Awaited<typeof q>, { Id: number; profile: Profile }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              row_to_json("profile".*) "profile"
            FROM "schema"."user" "u"
                   LEFT JOIN LATERAL (
              SELECT ${ProfileSelectAll}
              FROM "schema"."profile" "activeProfile"
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

      it('should support require() for inner join', () => {
        const q = db.user.as('u').select('Id', {
          profile: (q) => q.profile.require().select('Id'),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              row_to_json("profile".*) "profile"
            FROM "schema"."user" "u"
            JOIN LATERAL (
              SELECT "profile"."id" "Id"
              FROM "schema"."profile"
              WHERE "profile"."user_id" = "u"."id"
                AND "profile"."profile_key" = "u"."user_key"
            ) "profile" ON true
          `,
        );
      });

      it('should handle exists sub query', () => {
        const q = db.user.as('u').select('Id', {
          hasProfile: (q) => q.profile.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasProfile: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              COALESCE("hasProfile"."hasProfile", false) "hasProfile"
            FROM "schema"."user" "u"
            LEFT JOIN LATERAL (
              SELECT true "hasProfile"
              FROM "schema"."profile"
              WHERE "profile"."user_id" = "u"."id"
                AND "profile"."profile_key" = "u"."user_key"
            ) "hasProfile" ON true
          `,
        );
      });

      it('should handle exists sub query using `on`', () => {
        const q = db.user.as('u').select('Id', {
          hasProfile: (q) => q.activeProfile.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasProfile: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              COALESCE("hasProfile"."hasProfile", false) "hasProfile"
            FROM "schema"."user" "u"
            LEFT JOIN LATERAL (
              SELECT true "hasProfile"
              FROM "schema"."profile" "activeProfile"
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
            FROM "schema"."user" "User"
            LEFT JOIN LATERAL (
              SELECT ${userRowToJSON('user')} "user"
              FROM "schema"."profile"
              LEFT JOIN LATERAL (
                SELECT row_to_json("profile2".*) "profile"
                FROM "schema"."user"
                LEFT JOIN LATERAL (
                  SELECT ${ProfileSelectAll}
                  FROM "schema"."profile" "profile2"
                  WHERE "profile2"."user_id" = "user"."id"
                    AND "profile2"."profile_key" = "user"."user_key"
                ) "profile2" ON true
                WHERE "profile2"."Bio" = $1
                  AND "user"."id" = "profile"."user_id"
                  AND "user"."user_key" = "profile"."profile_key"
              ) "user" ON true
              WHERE "profile"."user_id" = "User"."id"
                AND "profile"."profile_key" = "User"."user_key"
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
            FROM "schema"."user" "activeUser"
            LEFT JOIN LATERAL (
              SELECT ${userRowToJSON('activeUser2')} "activeUser"
              FROM "schema"."profile" "activeProfile"
              LEFT JOIN LATERAL (
                SELECT row_to_json("activeProfile2".*) "activeProfile"
                FROM "schema"."user" "activeUser2"
                LEFT JOIN LATERAL (
                  SELECT ${ProfileSelectAll}
                  FROM "schema"."profile" "activeProfile2"
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
            UPDATE "schema"."profile" "Profile"
            SET
              "bio" = (
                SELECT "user"."name"
                FROM "schema"."user"
                WHERE "user"."id" = "Profile"."user_id"
                  AND "user"."user_key" = "Profile"."profile_key"
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
            UPDATE "schema"."profile" "Profile"
            SET
              "bio" = (
                SELECT "activeUser"."name"
                FROM "schema"."user" "activeUser"
                WHERE "activeUser"."active" = $1
                  AND "activeUser"."id" = "Profile"."user_id"
                  AND "activeUser"."user_key" = "Profile"."profile_key"
              ),
              "updated_at" = now()
          `,
          [true],
        );
      });
    });
  });

  describe('not required hasOne', () => {
    const UserTable = defineTable('user', { schema: () => 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      Name: t.name('name').text(),
      Password: t.name('password').text(),
      UserKey: t.name('user_key').text().nullable(),
      ...t.timestamps(),
    })).relations((user) => ({
      profile: user('Id')
        .hasOne(() => ProfileTable('UserId'))
        .required(false),
    }));

    const ProfileTable = defineTable(
      'profile',
      { schema: () => 'schema' },
      (t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserId: t.name('user_id').integer(),
      }),
    ).relations((profile) => ({
      user: profile('UserId')
        .belongsTo(() => UserTable('Id'))
        .required(false),
    }));

    const local = testOrchidORMWithAdapter(ormParams, {
      user: UserTable,
      profile: ProfileTable,
    });

    it('should query related record and get an `undefined`', async () => {
      const profile = await local.user.queryRelated('profile', { Id: 123 });
      expect(profile).toBe(undefined);
    });

    it('should be selectable', async () => {
      const id = await local.user.get('Id').create(UserData);

      const result = await local.user.select('Id', {
        profile: (q) => q.profile,
      });

      assertType<
        typeof result,
        {
          Id: number;
          profile: { Id: number; UserId: number } | undefined;
        }[]
      >();

      expect(result).toEqual([
        {
          Id: id,
          profile: undefined,
        },
      ]);
    });

    it('should return undefined when selecting nested relation of a missing optional relation', async () => {
      const id = await local.user.get('Id').create(UserData);

      const result = await local.user.find(id).select({
        profile: (q) =>
          q.profile.select({
            user: (q) => q.user.select('Name'),
          }),
      });

      assertType<
        typeof result,
        {
          profile: { user: { Name: string } | undefined } | undefined;
        }
      >();

      expect(result.profile).toBeUndefined();
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.user.where((q) =>
      q.profile.whereIn('Bio', ['a', 'b']).count().equals(1),
    );

    expectSql(
      q.toSQL(),
      `
          SELECT ${UserSelectAll} FROM "schema"."user" "User" WHERE (
            SELECT count(*) = $1
            FROM "schema"."profile"
            WHERE "profile"."bio" IN ($2, $3)
              AND "profile"."user_id" = "User"."id"
              AND "profile"."profile_key" = "User"."user_key"
          )
      `,
      [1, 'a', 'b'],
    );
  });
});
