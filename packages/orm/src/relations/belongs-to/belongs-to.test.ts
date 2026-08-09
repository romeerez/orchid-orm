import { NotFoundError, Query } from 'pqb';
import {
  messageSelectAll,
  userRowToJSON,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import { orchidORMWithAdapter } from '../../orm';
import {
  db,
  UserDefaultSelect,
  assertType,
  expectSql,
  ProfileData,
  UserData,
  UserSelectAll,
  ProfileSelectAll,
} from 'test-utils';
import { createTableFactory } from '../../orm-table/table';

const ormParams = { db: db.$qb };

const activeUserData = { ...UserData, Active: true };

describe('belongsTo', () => {
  useTestORM();

  it('should define foreign keys under autoForeignKeys option', () => {
    const { defineTable } = createTableFactory({
      autoForeignKeys: {
        onUpdate: 'CASCADE',
      },
    });

    const UserTable = defineTable('user', (t) => ({
      Id: t.name('id').identity().primaryKey(),
    }));

    const ProfileTable = defineTable('profile', (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserId: t.name('user_id').integer(),
      UserId2: t.name('user_id_2').integer(),
      UserId3: t.name('user_id_3').integer(),
    })).relations((profile) => ({
      user: profile('UserId').belongsTo(() => UserTable('Id')),
      user2: profile('UserId2')
        .belongsTo(() => UserTable('Id'))
        .foreignKey(false),
      user3: profile('UserId3')
        .belongsTo(() => UserTable('Id'))
        .foreignKey({
          onDelete: 'CASCADE',
        }),
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
      it('should query related data', async () => {
        const user = await db.user.create(UserData);
        const profile = await db.profile.create({
          ...ProfileData,
          UserId: user.Id,
        });

        const q = db.profile.queryRelated('user', profile);

        expectSql(
          q.toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user"
            WHERE "user"."id" = $1
              AND "user"."user_key" = $2
          `,
          [user.Id, 'key'],
        );

        const loaded = await q;
        expect(loaded).toMatchObject(user);
      });

      it('should query related data using `on`', async () => {
        const user = await db.user.create(activeUserData);
        const profile = await db.profile.create({
          ...ProfileData,
          UserId: user.Id,
        });

        const q = db.profile.queryRelated('activeUser', profile);

        expectSql(
          q.toSQL(),
          `
            SELECT ${UserSelectAll} FROM "schema"."user" "activeUser"
            WHERE "activeUser"."active" = $1
              AND "activeUser"."id" = $2
              AND "activeUser"."user_key" = $3
          `,
          [true, user.Id, 'key'],
        );

        const loaded = await q;
        expect(loaded).toMatchObject(user);
      });
    });

    it('should have proper joinQuery', () => {
      expectSql(
        (
          db.profile.relations.user.joinQuery(
            db.user.as('u'),
            db.profile.as('p'),
          ) as Query
        ).toSQL(),
        `
          SELECT ${UserSelectAll} FROM "schema"."user" "u"
          WHERE "u"."id" = "p"."user_id"
            AND "u"."user_key" = "p"."profile_key"
        `,
      );
    });

    describe('whereExists', () => {
      it('should be supported in whereExists', () => {
        expectSql(
          db.profile
            .as('p')
            .whereExists((q) => q.user.where({ Name: 'name' }))
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user"
              WHERE "User"."name" = $1
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            )
          `,
          ['name'],
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists('user', (q) => q.where({ 'user.Name': 'name' }))
            .toSQL(),
          `
          SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."user"
            WHERE "user"."id" = "p"."user_id"
              AND "user"."user_key" = "p"."profile_key"
              AND "user"."name" = $1
          )
        `,
          ['name'],
        );
      });

      it('should be supported in whereExists using `on`', () => {
        expectSql(
          db.profile
            .as('p')
            .whereExists((q) => q.activeUser.where({ Name: 'name' }))
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."name" = $2
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
            )
          `,
          [true, 'name'],
        );

        expectSql(
          db.profile
            .as('p')
            .whereExists('activeUser', (q) =>
              q.where({ 'activeUser.Name': 'name' }),
            )
            .toSQL(),
          `
            SELECT ${ProfileSelectAll} FROM "schema"."profile" "p"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
                AND "activeUser"."name" = $2
            )
          `,
          [true, 'name'],
        );
      });

      it('should support nested whereExists using `on`', () => {
        expectSql(
          db.message
            .as('m')
            .whereExists((q) =>
              q.activeSender.whereExists('profile', (q) =>
                q.where({ Bio: 'bio' }),
              ),
            )
            .toSQL(),
          `
              SELECT ${messageSelectAll} FROM "schema"."message" "m"
              WHERE (EXISTS (
                SELECT 1 FROM "schema"."user" "activeSender"
                WHERE "activeSender"."active" = $1
                  AND EXISTS (
                    SELECT 1 FROM "schema"."profile"
                    WHERE "profile"."user_id" = "activeSender"."id"
                      AND "profile"."profile_key" = "activeSender"."user_key"
                      AND "profile"."bio" = $2
                  )
                  AND "activeSender"."id" = "m"."author_id"
                  AND "activeSender"."user_key" = "m"."message_key"
              ))
                AND ("m"."deleted_at" IS NULL)
            `,
          [true, 'bio'],
        );

        expectSql(
          db.message
            .as('m')
            .whereExists('activeSender', (q) =>
              q.whereExists('activeProfile', (q) =>
                q.where({ 'activeProfile.Bio': 'bio' }),
              ),
            )
            .toSQL(),
          `
              SELECT ${messageSelectAll} FROM "schema"."message" "m"
              WHERE (EXISTS (
                SELECT 1 FROM "schema"."user" "activeSender"
                WHERE "activeSender"."active" = $1
                  AND "activeSender"."id" = "m"."author_id"
                  AND "activeSender"."user_key" = "m"."message_key"
                  AND EXISTS (
                    SELECT 1 FROM "schema"."profile" "activeProfile"
                    WHERE "activeProfile"."active" = $2
                      AND "activeProfile"."user_id" = "activeSender"."id"
                      AND "activeProfile"."profile_key" = "activeSender"."user_key"
                      AND "activeProfile"."bio" = $3
                  )
              ))
                AND ("m"."deleted_at" IS NULL)
            `,
          [true, true, 'bio'],
        );
      });
    });

    describe('join', () => {
      it('should be supported in join', () => {
        const q = db.profile
          .as('p')
          .join('user', (q) => q.where({ Name: 'name' }))
          .select('Bio', 'user.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "user"."name" "Name"
            FROM "schema"."profile" "p"
            JOIN "schema"."user"
              ON "user"."id" = "p"."user_id"
             AND "user"."user_key" = "p"."profile_key"
             AND "user"."name" = $1
          `,
          ['name'],
        );
      });

      it('should be supported in join using `on`', () => {
        const q = db.profile
          .as('p')
          .join('activeUser', (q) => q.where({ Name: 'name' }))
          .select('Bio', 'activeUser.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "activeUser"."name" "Name"
            FROM "schema"."profile" "p"
            JOIN "schema"."user" "activeUser"
              ON "activeUser"."active" = $1
             AND "activeUser"."id" = "p"."user_id"
             AND "activeUser"."user_key" = "p"."profile_key"
             AND "activeUser"."name" = $2
          `,
          [true, 'name'],
        );
      });

      it('should be supported in join with a callback', () => {
        const q = db.profile
          .as('p')
          .join(
            (q) => q.user.as('u').where({ Age: 20 }),
            (q) => q.where({ Name: 'name' }),
          )
          .select('Bio', 'u.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "u"."name" "Name"
            FROM "schema"."profile" "p"
            JOIN "schema"."user" "u"
              ON "u"."name" = $1
             AND "u"."age" = $2
             AND "u"."id" = "p"."user_id"
             AND "u"."user_key" = "p"."profile_key"
          `,
          ['name', 20],
        );
      });

      it('should be supported in join with a callback using `on`', () => {
        const q = db.profile
          .as('p')
          .join(
            (q) => q.activeUser.as('u').where({ Age: 20 }),
            (q) => q.where({ Name: 'name' }),
          )
          .select('Bio', 'u.Name');

        assertType<Awaited<typeof q>, { Bio: string | null; Name: string }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT "p"."bio" "Bio", "u"."name" "Name"
            FROM "schema"."profile" "p"
            JOIN "schema"."user" "u"
              ON "u"."name" = $1
             AND "u"."active" = $2
             AND "u"."age" = $3
             AND "u"."id" = "p"."user_id"
             AND "u"."user_key" = "p"."profile_key"
          `,
          ['name', true, 20],
        );
      });

      it('should be supported in joinLateral', () => {
        const q = db.profile
          .joinLateral('user', (q) => q.as('u').where({ Name: 'one' }))
          .where({ 'u.Name': 'two' })
          .select('Bio', 'u.*');

        assertType<
          Awaited<typeof q>,
          { Bio: string | null; u: UserDefaultSelect }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "Profile"."bio" "Bio", ${userRowToJSON('u')} "u"
            FROM "schema"."profile" "Profile"
            JOIN LATERAL (
              SELECT ${UserSelectAll}
              FROM "schema"."user" "u"
              WHERE "u"."name" = $1
                AND "u"."id" = "Profile"."user_id"
                AND "u"."user_key" = "Profile"."profile_key"
            ) "u" ON true
            WHERE "u"."Name" = $2
          `,
          ['one', 'two'],
        );
      });

      it('should be supported in joinLateral using `on`', () => {
        const q = db.profile
          .joinLateral('activeUser', (q) => q.as('u').where({ Name: 'one' }))
          .where({ 'u.Name': 'two' })
          .select('Bio', 'u.*');

        assertType<
          Awaited<typeof q>,
          { Bio: string | null; u: UserDefaultSelect }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT "Profile"."bio" "Bio", ${userRowToJSON('u')} "u"
            FROM "schema"."profile" "Profile"
            JOIN LATERAL (
              SELECT ${UserSelectAll}
              FROM "schema"."user" "u"
              WHERE "u"."active" = $1
                AND "u"."name" = $2
                AND "u"."id" = "Profile"."user_id"
                AND "u"."user_key" = "Profile"."profile_key"
            ) "u" ON true
            WHERE "u"."Name" = $3
          `,
          [true, 'one', 'two'],
        );
      });
    });

    describe('select', () => {
      it('should be selectable', () => {
        const q = db.profile
          .as('p')
          .select('Id', {
            user: (q) => q.user.select('Id', 'Name').where({ Name: 'name' }),
          })
          .order('user.Name');

        assertType<
          Awaited<typeof q>,
          { Id: number; user: { Id: number; Name: string } | undefined }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              row_to_json("user".*) "user"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT "user"."id" "Id", "user"."name" "Name"
              FROM "schema"."user"
              WHERE "user"."name" = $1
                AND "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            ) "user" ON true
            ORDER BY "user"."Name" ASC
          `,
          ['name'],
        );
      });

      it('should be selectable using `on`', () => {
        const q = db.profile
          .as('p')
          .select('Id', {
            user: (q) =>
              q.activeUser.select('Id', 'Name').where({ Name: 'name' }),
          })
          .order('user.Name');

        assertType<
          Awaited<typeof q>,
          { Id: number; user: { Id: number; Name: string } | undefined }[]
        >();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              row_to_json("user".*) "user"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT "activeUser"."id" "Id", "activeUser"."name" "Name"
              FROM "schema"."user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."name" = $2
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
              ) "user" ON true
            ORDER BY "user"."Name" ASC
          `,
          [true, 'name'],
        );
      });

      it('should support require() for inner join', () => {
        const q = db.user.as('u').select('Id', {
          p: (q) => q.onePost.require().select('Id'),
        });

        assertType<Awaited<typeof q>, { Id: number; p: { Id: number } }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "u"."id" "Id",
              row_to_json("p".*) "p"
            FROM "schema"."user" "u"
            JOIN LATERAL (
              SELECT "onePost"."id" "Id"
              FROM "schema"."post" "onePost"
              WHERE "onePost"."user_id" = "u"."id"
                AND "onePost"."title" = "u"."user_key"
            ) "p" ON true
          `,
        );
      });

      it('should handle exists sub query', () => {
        const q = db.profile.as('p').select('Id', {
          hasUser: (q) => q.user.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasUser: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasUser"."hasUser", false) "hasUser"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT true "hasUser"
              FROM "schema"."user"
              WHERE "user"."id" = "p"."user_id"
                AND "user"."user_key" = "p"."profile_key"
            ) "hasUser" ON true
          `,
        );
      });

      it('should handle exists sub query using `on`', () => {
        const q = db.profile.as('p').select('Id', {
          hasUser: (q) => q.activeUser.exists(),
        });

        assertType<Awaited<typeof q>, { Id: number; hasUser: boolean }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "p"."id" "Id",
              COALESCE("hasUser"."hasUser", false) "hasUser"
            FROM "schema"."profile" "p"
            LEFT JOIN LATERAL (
              SELECT true "hasUser"
              FROM "schema"."user" "activeUser"
              WHERE "activeUser"."active" = $1
                AND "activeUser"."id" = "p"."user_id"
                AND "activeUser"."user_key" = "p"."profile_key"
            ) "hasUser" ON true
          `,
          [true],
        );
      });

      it('should support recurring select', () => {
        const q = db.profile.as('profile').select({
          user: (q) =>
            q.user.select({
              profile: (q) =>
                q.profile
                  .select({
                    user: (q) => q.user,
                  })
                  .where({ 'user.Name': 'name' }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT row_to_json("user".*) "user"
            FROM "schema"."profile"
            LEFT JOIN LATERAL (
              SELECT row_to_json("profile2".*) "profile"
              FROM "schema"."user"
              LEFT JOIN LATERAL (
                SELECT ${userRowToJSON('user2')} "user"
                FROM "schema"."profile" "profile2"
                LEFT JOIN LATERAL (
                  SELECT ${UserSelectAll}
                  FROM "schema"."user" "user2"
                  WHERE "user2"."id" = "profile2"."user_id"
                    AND "user2"."user_key" = "profile2"."profile_key"
                ) "user2" ON true
                WHERE "user2"."Name" = $1
                  AND "profile2"."user_id" = "user"."id"
                  AND "profile2"."profile_key" = "user"."user_key"
              ) "profile2" ON true
              WHERE "user"."id" = "profile"."user_id"
                AND "user"."user_key" = "profile"."profile_key"
            ) "user" ON true
          `,
          ['name'],
        );
      });

      it('should support recurring select using `on`', () => {
        const q = db.profile.as('profile').select({
          activeUser: (q) =>
            q.activeUser.select({
              profile: (q) =>
                q.profile
                  .select({
                    activeUser: (q) => q.activeUser,
                  })
                  .where({ 'activeUser.Name': 'name' }),
            }),
        });

        expectSql(
          q.toSQL(),
          `
            SELECT row_to_json("activeUser".*) "activeUser"
            FROM "schema"."profile"
            LEFT JOIN LATERAL (
              SELECT row_to_json("profile2".*) "profile"
              FROM "schema"."user" "activeUser"
              LEFT JOIN LATERAL (
                SELECT ${userRowToJSON('activeUser2')} "activeUser"
                FROM "schema"."profile" "profile2"
                LEFT JOIN LATERAL (
                  SELECT ${UserSelectAll}
                  FROM "schema"."user" "activeUser2"
                  WHERE "activeUser2"."active" = $1
                    AND "activeUser2"."id" = "profile2"."user_id"
                    AND "activeUser2"."user_key" = "profile2"."profile_key"
                ) "activeUser2" ON true
                WHERE "activeUser2"."Name" = $2
                  AND "profile2"."user_id" = "activeUser"."id"
                  AND "profile2"."profile_key" = "activeUser"."user_key"
              ) "profile2" ON true
              WHERE "activeUser"."active" = $3
                AND "activeUser"."id" = "profile"."user_id"
                AND "activeUser"."user_key" = "profile"."profile_key"
            ) "activeUser" ON true
          `,
          [true, 'name', true],
        );
      });
    });
  });

  describe('not required belongsTo', () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      Name: t.name('name').text(),
      Password: t.name('password').text(),
    })).relations((user) => ({
      profile: user('Id').hasOne(() => ProfileTable('UserId')),
    }));

    const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserId: t.name('user_id').integer().nullable(),
      ProfileKey: t.name('profile_key').string().nullable(),
      Bio: t.name('bio').text().nullable(),
      ...t.timestamps(),
    })).relations((profile) => ({
      user: profile('UserId').belongsTo(() => UserTable('Id')),
    }));

    const db = orchidORMWithAdapter(ormParams, {
      user: UserTable,
      profile: ProfileTable,
    });

    it('should query related record and get `undefined`', async () => {
      const user = await db.profile.queryRelated('user', { UserId: 123 });
      assertType<
        typeof user,
        { Id: number; Name: string; Password: string } | undefined
      >();

      expect(user).toBe(undefined);
    });

    it('should be selectable', async () => {
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: null });

      const result = await db.profile.select('Id', {
        user: (q) => q.user,
      });

      assertType<
        typeof result,
        {
          Id: number;
          user: { Id: number; Name: string; Password: string } | undefined;
        }[]
      >();

      expect(result).toEqual([
        {
          Id: id,
          user: undefined,
        },
      ]);
    });

    it('should return undefined when selecting nested relation of a missing optional relation', async () => {
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: null });

      const result = await db.profile.find(id).select({
        user: (q) =>
          q.user.select({
            profile: (q) => q.profile.select('Bio'),
          }),
      });

      assertType<
        typeof result,
        {
          user: { profile: { Bio: string | null } | undefined } | undefined;
        }
      >();

      expect(result.user).toBeUndefined();
    });
  });

  describe('inferred required belongsTo', () => {
    const { defineTable } = createTableFactory({ snakeCase: true });
    const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserKey: t.name('user_key').text(),
      Name: t.name('name').text(),
      Password: t.name('password').text(),
    }));

    const SoftDeletedUserTable = defineTable(
      'soft_deleted_user',
      { schema: 'schema' },
      (t) => ({
        Id: t.name('id').identity().primaryKey(),
        UserKey: t.name('user_key').text(),
        Name: t.name('name').text(),
        Password: t.name('password').text(),
        deletedAt: t.timestamp().nullable(),
      }),
    ).softDelete();

    const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
      Id: t.name('id').identity().primaryKey(),
      UserId: t.name('user_id').integer(),
      SoftDeletedUserId: t.name('soft_deleted_user_id').integer(),
      OptionalUserId: t.name('optional_user_id').integer().nullable(),
      ProfileKey: t.name('profile_key').text(),
      OptionalProfileKey: t.name('optional_profile_key').text().nullable(),
      Bio: t.name('bio').text().nullable(),
    })).relations((profile) => ({
      user: profile('UserId').belongsTo(() => UserTable('Id')),
      softDeletedUser: profile('SoftDeletedUserId').belongsTo(() =>
        SoftDeletedUserTable('Id'),
      ),
      optionalUser: profile('OptionalUserId').belongsTo(() => UserTable('Id')),
      forcedOptionalUser: profile('UserId')
        .belongsTo(() => UserTable('Id'))
        .required(false),
      compositeUser: profile('UserId', 'ProfileKey').belongsTo(() =>
        UserTable('Id', 'UserKey'),
      ),
      optionalCompositeUser: profile('UserId', 'OptionalProfileKey').belongsTo(
        () => UserTable('Id', 'UserKey'),
      ),
    }));

    const db = orchidORMWithAdapter(ormParams, {
      user: UserTable,
      softDeletedUser: SoftDeletedUserTable,
      profile: ProfileTable,
    });

    it('should infer required for omitted required when all local columns are non-nullable', async () => {
      const q = db.profile.queryRelated('user', { UserId: 123 });

      assertType<
        Awaited<typeof q>,
        { Id: number; UserKey: string; Name: string; Password: string }
      >();

      const result = await q.catch((error) => error);

      expect(result).toEqual(expect.any(NotFoundError));
    });

    it('should infer optional for omitted required when related table has soft delete', () => {
      db.profile.select({
        softDeletedUser: (q) => q.softDeletedUser,
      });

      expect(db.profile.relations.softDeletedUser.query.q.returnType).toBe(
        'one',
      );
    });

    it('should infer optional for omitted required when any local column is nullable', async () => {
      const single = await db.profile.queryRelated('optionalUser', {
        OptionalUserId: 123,
      });
      const composite = await db.profile.queryRelated('optionalCompositeUser', {
        UserId: 123,
        OptionalProfileKey: 'key',
      });

      assertType<
        typeof single,
        | { Id: number; UserKey: string; Name: string; Password: string }
        | undefined
      >();
      assertType<
        typeof composite,
        | { Id: number; UserKey: string; Name: string; Password: string }
        | undefined
      >();

      expect(single).toBe(undefined);
      expect(composite).toBe(undefined);
    });

    it('should respect explicit required false when local columns are non-nullable', async () => {
      const result = await db.profile.queryRelated('forcedOptionalUser', {
        UserId: 123,
      });

      assertType<
        typeof result,
        | { Id: number; UserKey: string; Name: string; Password: string }
        | undefined
      >();

      expect(result).toBe(undefined);
    });

    it('should infer required for composite belongsTo when all local columns are non-nullable', async () => {
      const q = db.profile.queryRelated('compositeUser', {
        UserId: 123,
        ProfileKey: 'key',
      });

      assertType<
        Awaited<typeof q>,
        { Id: number; UserKey: string; Name: string; Password: string }
      >();

      const result = await q.catch((error) => error);

      expect(result).toEqual(expect.any(NotFoundError));
    });

    it('should require a non-nullable belongsTo foreign key or nested relation when creating', () => {
      const SingleProfileTable = defineTable(
        'profile',
        { schema: 'schema' },
        (t) => ({
          Id: t.name('id').identity().primaryKey(),
          UserId: t.name('user_id').integer(),
          Bio: t.name('bio').text().nullable(),
        }),
      ).relations((profile) => ({
        user: profile('UserId').belongsTo(() => UserTable('Id')),
      }));

      const db = orchidORMWithAdapter(ormParams, {
        user: UserTable,
        profile: SingleProfileTable,
      });

      // @ts-expect-error UserId or user is required
      db.profile.create({
        Bio: 'bio',
      });

      db.profile.create({
        UserId: 1,
      });

      db.profile.create({
        user: {
          connect: {
            Id: 1,
          },
        },
      });
    });
  });

  it('should be supported in a `where` callback', () => {
    const q = db.profile.where((q) =>
      q.user.whereIn('Name', ['a', 'b']).count().equals(1),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT ${ProfileSelectAll} FROM "schema"."profile" "Profile" WHERE (
          SELECT count(*) = $1
          FROM "schema"."user"
          WHERE "user"."name" IN ($2, $3)
            AND "user"."id" = "Profile"."user_id"
            AND "user"."user_key" = "Profile"."profile_key"
        )
      `,
      [1, 'a', 'b'],
    );
  });

  it('should have a proper argument type in `create` when the table has 2+ `belongsTo` relations', () => {
    const { defineTable } = createTableFactory();
    const ATable = defineTable('a', (t) => ({
      id: t.identity().primaryKey(),
      bId: t.integer(),
      cId: t.integer(),
    })).relations((a) => ({
      b: a('bId')
        .belongsTo(() => ATable('id'))
        .required(),
      c: a('cId')
        .belongsTo(() => ATable('id'))
        .required(),
    }));

    const db = orchidORMWithAdapter(ormParams, { a: ATable });

    // @ts-expect-error cId or c is required
    db.a.create({
      bId: 1,
    });

    db.a.create({
      bId: 1,
      cId: 1,
    });

    // @ts-expect-error cId or c is required
    db.a.create({
      b: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
    });

    db.a.create({
      b: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
      c: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
    });

    db.a.create({
      b: {
        create: {
          bId: 1,
          cId: 1,
        },
      },
      cId: 1,
    });
  });

  it('should allow omitting a foreign key when one of several `belongsTo` relations using it is provided', () => {
    const { defineTable } = createTableFactory();
    const UserTable = defineTable('user', (t) => ({
      id: t.identity().primaryKey(),
      active: t.boolean(),
    }));

    const ProfileTable = defineTable('profile', (t) => ({
      id: t.identity().primaryKey(),
      userId: t.integer(),
    })).relations((profile) => ({
      user: profile('userId')
        .belongsTo(() => UserTable('id'))
        .required(),
      activeUser: profile('userId')
        .belongsTo(() => UserTable('id').where({ active: true }))
        .required(),
    }));

    const db = orchidORMWithAdapter(ormParams, {
      profile: ProfileTable,
      user: UserTable,
    });

    // @ts-expect-error userId or one of the relations is required
    db.profile.create({});

    db.profile.create({
      activeUser: {
        create: {
          active: true,
        },
      },
    });
  });
});
