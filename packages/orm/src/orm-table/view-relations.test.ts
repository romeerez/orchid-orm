import { useTestORM } from '../test-utils/orm.test-utils';
import {
  assertType,
  db,
  expectSql,
  testAdapter,
  testOrchidORMWithAdapter,
} from 'test-utils';
import { orchidORMWithAdapter } from '../orm';
import { CannotMutateReadOnlyTableError } from 'pqb/internal';
import { createTableFactory } from './table';

describe('view relations', () => {
  useTestORM();

  it('should support view relations with tables', () => {
    const { defineTable, defineView } = createTableFactory();
    const UserTable = defineTable('user', (t) => ({
      id: t.identity().primaryKey(),
      activeUserId: t.integer(),
    }));
    const ProfileTable = defineTable('profile', (t) => ({
      id: t.identity().primaryKey(),
      userId: t.integer(),
      requiredUserId: t.integer(),
      pictureId: t.integer(),
    }));
    const PictureTable = defineTable('picture', (t) => ({
      id: t.identity().primaryKey(),
    }));
    const TaskTable = defineTable('task', (t) => ({
      id: t.identity().primaryKey(),
    }));
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      optionalUserId: t.integer().nullable(),
      requiredUserId: t.integer(),
      optionalProfileId: t.integer().nullable(),
      profileId: t.integer(),
    })).relations((activeUser) => ({
      user: activeUser('optionalUserId').belongsTo(() => UserTable('id')),
      requiredUser: activeUser('requiredUserId')
        .belongsTo(() => UserTable('activeUserId'))
        .required(),
      optionalProfile: activeUser('optionalProfileId').hasOne(() =>
        ProfileTable('id'),
      ),
      profile: activeUser('profileId')
        .hasOne(() => ProfileTable('id'))
        .required(),
      profiles: activeUser('id').hasMany(() => ProfileTable('requiredUserId')),
      picture: activeUser.hasOne(() =>
        PictureTable.through('profile', 'picture'),
      ),
      pictures: activeUser.hasMany(() =>
        PictureTable.through('profiles', 'picture'),
      ),
      tasks: activeUser('id')
        .hasAndBelongsToMany(() => TaskTable('id'))
        .through('userTasks', 'userId', 'taskId'),
    }));

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { activeUser: ActiveUserView },
      },
      {
        user: UserTable,
        profile: ProfileTable.relations((profile) => ({
          picture: profile('pictureId').hasOne(() => PictureTable('id')),
        })),
        picture: PictureTable,
        task: TaskTable,
      },
    );

    const belongsToQuery = db.$views.activeUser.select({
      user: (q) => q.user,
    });
    const requiredBelongsToQuery = db.$views.activeUser.select({
      requiredUser: (q) => q.requiredUser,
    });
    const optionalHasOneQuery = db.$views.activeUser.select({
      optionalProfile: (q) => q.optionalProfile,
    });
    const hasOneQuery = db.$views.activeUser.select({
      profile: (q) => q.profile,
    });
    const hasManyQuery = db.$views.activeUser.select({
      profiles: (q) => q.profiles,
    });
    const hasOneThroughQuery = db.$views.activeUser.select({
      picture: (q) => q.picture,
    });
    const hasManyThroughQuery = db.$views.activeUser.select({
      pictures: (q) => q.pictures,
    });
    const hasAndBelongsToManyQuery = db.$views.activeUser.select({
      tasks: (q) => q.tasks,
    });

    assertType<
      Awaited<typeof belongsToQuery>,
      { user: { id: number; activeUserId: number } | undefined }[]
    >();
    assertType<
      Awaited<typeof requiredBelongsToQuery>,
      { requiredUser: { id: number; activeUserId: number } }[]
    >();
    assertType<
      Awaited<typeof optionalHasOneQuery>,
      {
        optionalProfile:
          | {
              id: number;
              userId: number;
              requiredUserId: number;
              pictureId: number;
            }
          | undefined;
      }[]
    >();
    assertType<
      Awaited<typeof hasOneQuery>,
      {
        profile: {
          id: number;
          userId: number;
          requiredUserId: number;
          pictureId: number;
        };
      }[]
    >();
    assertType<
      Awaited<typeof hasManyQuery>,
      {
        profiles: {
          id: number;
          userId: number;
          requiredUserId: number;
          pictureId: number;
        }[];
      }[]
    >();
    assertType<
      Awaited<typeof hasOneThroughQuery>,
      { picture: { id: number } | undefined }[]
    >();
    assertType<
      Awaited<typeof hasManyThroughQuery>,
      { pictures: { id: number }[] }[]
    >();
    assertType<
      Awaited<typeof hasAndBelongsToManyQuery>,
      { tasks: { id: number }[] }[]
    >();
  });

  it('should support view relations with views', () => {
    const { defineView } = createTableFactory();
    const UserView = defineView('user', (t) => ({
      id: t.integer(),
      activeUserId: t.integer(),
    }));
    const ProfileView = defineView('profile', (t) => ({
      id: t.integer(),
      userId: t.integer(),
      requiredUserId: t.integer(),
      pictureId: t.integer(),
    }));
    const PictureView = defineView('picture', (t) => ({
      id: t.integer(),
    }));
    const TaskView = defineView('task', (t) => ({
      id: t.integer(),
    }));
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      optionalUserId: t.integer().nullable(),
      requiredUserId: t.integer(),
      optionalProfileId: t.integer().nullable(),
      profileId: t.integer(),
    })).relations((activeUser) => ({
      user: activeUser('optionalUserId').belongsTo(() => UserView('id')),
      requiredUser: activeUser('requiredUserId')
        .belongsTo(() => UserView('activeUserId'))
        .required(),
      optionalProfile: activeUser('optionalProfileId').hasOne(() =>
        ProfileView('id'),
      ),
      profile: activeUser('profileId')
        .hasOne(() => ProfileView('id'))
        .required(),
      profiles: activeUser('id').hasMany(() => ProfileView('requiredUserId')),
      picture: activeUser.hasOne(() =>
        PictureView.through('profile', 'picture'),
      ),
      pictures: activeUser.hasMany(() =>
        PictureView.through('profiles', 'picture'),
      ),
      tasks: activeUser('id')
        .hasAndBelongsToMany(() => TaskView('id'))
        .through('userTasks', 'userId', 'taskId'),
    }));

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          activeUser: ActiveUserView,
          user: UserView,
          profile: ProfileView.relations((profile) => ({
            picture: profile('pictureId').hasOne(() => PictureView('id')),
          })),
          picture: PictureView,
          task: TaskView,
        },
      },
      {},
    );

    const belongsToQuery = db.$views.activeUser.select({
      user: (q) => q.user,
    });
    const requiredBelongsToQuery = db.$views.activeUser.select({
      requiredUser: (q) => q.requiredUser,
    });
    const optionalHasOneQuery = db.$views.activeUser.select({
      optionalProfile: (q) => q.optionalProfile,
    });
    const hasOneQuery = db.$views.activeUser.select({
      profile: (q) => q.profile,
    });
    const hasManyQuery = db.$views.activeUser.select({
      profiles: (q) => q.profiles,
    });
    const hasOneThroughQuery = db.$views.activeUser.select({
      picture: (q) => q.picture,
    });
    const hasManyThroughQuery = db.$views.activeUser.select({
      pictures: (q) => q.pictures,
    });
    const hasAndBelongsToManyQuery = db.$views.activeUser.select({
      tasks: (q) => q.tasks,
    });

    assertType<
      Awaited<typeof belongsToQuery>,
      { user: { id: number; activeUserId: number } | undefined }[]
    >();
    assertType<
      Awaited<typeof requiredBelongsToQuery>,
      { requiredUser: { id: number; activeUserId: number } }[]
    >();
    assertType<
      Awaited<typeof optionalHasOneQuery>,
      {
        optionalProfile:
          | {
              id: number;
              userId: number;
              requiredUserId: number;
              pictureId: number;
            }
          | undefined;
      }[]
    >();
    assertType<
      Awaited<typeof hasOneQuery>,
      {
        profile: {
          id: number;
          userId: number;
          requiredUserId: number;
          pictureId: number;
        };
      }[]
    >();
    assertType<
      Awaited<typeof hasManyQuery>,
      {
        profiles: {
          id: number;
          userId: number;
          requiredUserId: number;
          pictureId: number;
        }[];
      }[]
    >();
    assertType<
      Awaited<typeof hasOneThroughQuery>,
      { picture: { id: number } | undefined }[]
    >();
    assertType<
      Awaited<typeof hasManyThroughQuery>,
      { pictures: { id: number }[] }[]
    >();
    assertType<
      Awaited<typeof hasAndBelongsToManyQuery>,
      { tasks: { id: number }[] }[]
    >();
  });

  describe('relations', () => {
    it('should select belongsTo relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({ rel: (q) => q.user.select('Id') })
          .toSQL(),
        `
          SELECT row_to_json("rel".*) "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT "user"."id" "Id"
            FROM "schema"."user"
            WHERE "user"."id" = "activeUser"."id"
          ) "rel" ON true
        `,
      );
    });

    it('should select hasOne relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({ rel: (q) => q.profile.select('Id') })
          .toSQL(),
        `
          SELECT row_to_json("rel".*) "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT "profile"."id" "Id"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "activeUser"."id"
          ) "rel" ON true
        `,
      );
    });

    it('should select hasOne through relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({
            rel: (q) => q.profilePic.select('Id'),
          })
          .toSQL(),
        `
          SELECT row_to_json("rel".*) "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT "profilePic"."id" "Id"
            FROM "schema"."profilePic"
            WHERE EXISTS (
              SELECT 1 FROM "schema"."profile"
              WHERE "profilePic"."profile_id" = "profile"."id"
                AND "profilePic"."profile_pic_key" = "profile"."profile_key"
                AND "profile"."user_id" = "activeUser"."id"
            )
          ) "rel" ON true
        `,
      );
    });

    it('should select hasMany relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({ rel: (q) => q.profiles.select('Id') })
          .toSQL(),
        `
          SELECT COALESCE("rel"."rel", '[]') "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "rel"
            FROM (
              SELECT "profiles"."id" "Id"
              FROM "schema"."profile" "profiles"
              WHERE "profiles"."user_id" = "activeUser"."id"
            ) "t"
          ) "rel" ON true
        `,
      );
    });

    it('should select hasMany through relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({ rel: (q) => q.posts.select('Id') })
          .toSQL(),
        `
          SELECT COALESCE("rel"."rel", '[]') "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "rel"
            FROM (
              SELECT "posts"."id" "Id"
              FROM "schema"."post" "posts"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."user"
                WHERE "posts"."user_id" = "user"."id"
                  AND "posts"."title" = "user"."user_key"
                  AND "user"."id" = "activeUser"."id"
              )
            ) "t"
          ) "rel" ON true
        `,
      );
    });

    it('should select hasAndBelongsToMany relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({
            rel: (q) => q.chats.select('IdOfChat'),
          })
          .toSQL(),
        `
          SELECT COALESCE("rel"."rel", '[]') "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT json_agg(row_to_json(t.*)) "rel"
            FROM (
              SELECT "chats"."id_of_chat" "IdOfChat"
              FROM "schema"."chat" "chats"
              WHERE EXISTS (
                SELECT 1 FROM "schema"."chat_user"
                WHERE "chat_user"."chat_id" = "chats"."id_of_chat"
                  AND "chat_user"."user_id" = "activeUser"."id"
              )
            ) "t"
          ) "rel" ON true
        `,
      );
    });

    it('should select view to view relation from a view', () => {
      expectSql(
        db.$views.activeUser
          .select({
            rel: (q) => q.writableActiveUser.select('id'),
          })
          .toSQL(),
        `
          SELECT row_to_json("rel".*) "rel"
          FROM "schema"."activeUser"
          LEFT JOIN LATERAL (
            SELECT "writableActiveUser"."id"
            FROM "schema"."activeUser" "writableActiveUser"
            WHERE "writableActiveUser"."id" = "activeUser"."id"
          ) "rel" ON true
        `,
      );
    });

    it('should chain a relation from a view', () => {
      expectSql(
        db.$views.activeUser.chain('profile').select('Id').toSQL(),
        `
          SELECT "profile"."id" "Id"
          FROM "schema"."profile"
          WHERE EXISTS (
            SELECT 1 FROM "schema"."activeUser"
            WHERE "activeUser"."id" = "profile"."user_id"
          )
        `,
      );
    });

    it('should select and chain a relation from a table to a view', () => {
      const { defineTable, defineView, sql } = createTableFactory({
        snakeCase: true,
      });
      const LocalActiveUserView = defineView(
        'activeUser',
        { sql: sql`SELECT "id" FROM "schema"."user"` },
        (t) => ({
          id: t.identity().primaryKey(),
        }),
      );

      const MissingUserTable = defineTable('missingUser', (t) => ({
        Id: t.name('id').identity().primaryKey(),
      })).relations((main) => ({
        activeUser: main('Id').hasOne(() => LocalActiveUserView('id')),
      }));

      const local = orchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            activeUser: LocalActiveUserView,
          },
        },
        {
          missingUser: MissingUserTable,
        },
      );

      expectSql(
        local.missingUser
          .select({ activeUser: (q) => q.activeUser.select('id') })
          .toSQL(),
        `
          SELECT row_to_json("activeUser".*) "activeUser"
          FROM "missing_user" "missingUser"
          LEFT JOIN LATERAL (
            SELECT "activeUser"."id"
            FROM "active_user" "activeUser"
            WHERE "activeUser"."id" = "missingUser"."id"
          ) "activeUser" ON true
        `,
      );

      expectSql(
        local.missingUser.chain('activeUser').select('id').toSQL(),
        `
          SELECT "activeUser"."id"
          FROM "active_user" "activeUser"
          WHERE EXISTS (
            SELECT 1 FROM "missing_user" "missingUser"
            WHERE "missingUser"."id" = "activeUser"."id"
          )
        `,
      );
    });

    it('should select and chain relations across materialized views', () => {
      const { defineTable, defineView, sql } = createTableFactory({
        snakeCase: true,
      });

      const LocalActiveUserView = defineView(
        'activeUser',
        { sql: sql`SELECT "id" FROM "user"`, materialized: true },
        (t) => ({
          id: t.identity().primaryKey(),
        }),
      ).relations((view) => ({
        user: view('id').belongsTo(() => LocalUserTable('id')),
      }));

      const LocalUserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      })).relations((user) => ({
        activeUser: user('id').hasOne(() => LocalActiveUserView('id')),
      }));

      const local = orchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            activeUser: LocalActiveUserView,
          },
        },
        {
          user: LocalUserTable,
        },
      );

      expectSql(
        local.user
          .select({ activeUser: (q) => q.activeUser.select('id') })
          .toSQL(),
        `
          SELECT row_to_json("activeUser".*) "activeUser"
          FROM "user"
          LEFT JOIN LATERAL (
            SELECT "activeUser"."id"
            FROM "active_user" "activeUser"
            WHERE "activeUser"."id" = "user"."id"
          ) "activeUser" ON true
        `,
      );

      expectSql(
        local.$views.activeUser.chain('user').select('id').toSQL(),
        `
          SELECT "user"."id"
          FROM "user"
          WHERE EXISTS (
            SELECT 1 FROM "active_user" "activeUser"
            WHERE "activeUser"."id" = "user"."id"
          )
        `,
      );
    });
  });

  describe('nested writes', () => {
    const readOnlyError = CannotMutateReadOnlyTableError;

    const { defineTable, defineView, sql } = createTableFactory({
      snakeCase: true,
    });

    const LocalActiveUserView = defineView(
      'activeUser',
      { sql: sql`SELECT "id", "name", "password" FROM "schema"."user"` },
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }),
    );

    const LocalWritableActiveUserView = defineView(
      'activeUser',
      {
        id: 'writableActiveUser',
        sql: sql`SELECT "id", "name", "password" FROM "schema"."user"`,
        readOnly: false,
      },
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }),
    );

    const LocalProfileTable = defineTable('profile', (t) => ({
      id: t.identity().primaryKey(),
      activeUserId: t.integer().nullable(),
      writableActiveUserId: t.integer().nullable(),
      bio: t.text().nullable(),
    })).relations((profile) => ({
      writableActiveUser: profile('writableActiveUserId').belongsTo(() =>
        LocalWritableActiveUserView('id'),
      ),
      activeUser: profile('activeUserId').belongsTo(() =>
        LocalActiveUserView('id'),
      ),
    }));

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        schema: () => 'schema',
        views: {
          writableActiveUser: LocalWritableActiveUserView,
          activeUser: LocalActiveUserView,
        },
      },
      {
        profile: LocalProfileTable,
      },
    );

    it('should support nested create of a writable view from a table', () => {
      const query = local.profile.create({
        bio: 'bio',
        writableActiveUser: {
          create: {
            name: 'name',
            password: 'password',
          },
        },
      });

      expectSql(
        query.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "schema"."active_user" AS "writableActiveUser"("name", "password")
            VALUES ($1, $2)
            RETURNING "writableActiveUser"."id"
          )
          INSERT INTO "schema"."profile"("bio", "writable_active_user_id")
          VALUES ($3, (SELECT "q"."id" FROM "q"))
          RETURNING "id", "active_user_id" "activeUserId",
            "writable_active_user_id" "writableActiveUserId", "bio"
        `,
        ['name', 'password', 'bio'],
      );
    });

    it('should reject nested create of a read-only view from a table', () => {
      expect(() =>
        local.profile.create({
          bio: 'bio',
          // @ts-expect-error read-only view relation cannot create
          activeUser: {
            create: {
              name: 'name',
              password: 'password',
            },
          },
        }),
      ).toThrow(readOnlyError);
    });

    it('should support nested update of a writable view from a table', () => {
      const query = local.profile.find(1).update({
        writableActiveUser: {
          update: {
            name: 'updated',
          },
        },
      });

      expectSql(
        query.toSQL(),
        `
          WITH q AS (
            SELECT count(*),
              "profile"."writable_active_user_id" "writableActiveUserId"
            FROM "schema"."profile"
            WHERE "profile"."id" = $1
          ), "q2" AS (
            UPDATE "schema"."active_user" "writableActiveUser"
            SET "name" = $2
            WHERE "writableActiveUser"."id" IN (
              SELECT "q"."writableActiveUserId" FROM "q"
            )
            RETURNING NULL
          )
          SELECT * FROM q
        `,
        [1, 'updated'],
      );
    });

    it('should reject nested update of a read-only view from a table', () => {
      expect(() =>
        local.profile.find(1).update({
          activeUser: {
            // @ts-expect-error read-only view relation cannot update
            update: {
              name: 'updated',
            },
          },
        }),
      ).toThrow(readOnlyError);
    });

    it('should support nested delete of a writable view from a table', () => {
      const query = local.profile.find(1).update({
        writableActiveUser: {
          delete: true,
        },
      });

      expectSql(
        query.toSQL(),
        `
          WITH "q" AS (
            SELECT DISTINCT
              "profile"."writable_active_user_id" "writableActiveUserId"
            FROM "schema"."profile"
            WHERE "profile"."id" = $1
          ), q2 AS (
            UPDATE "schema"."profile"
            SET "writable_active_user_id" = $2
            WHERE "profile"."writable_active_user_id" IN (
              SELECT "q"."writableActiveUserId" FROM "q"
            )
            RETURNING "profile"."writable_active_user_id" "writableActiveUserId"
          ), "q3" AS (
            DELETE FROM "schema"."active_user" "writableActiveUser"
            WHERE "writableActiveUser"."id" IN (
              SELECT "q"."writableActiveUserId" FROM "q"
            )
            RETURNING NULL
          )
          SELECT * FROM q2
        `,
        [1, null],
      );
    });

    it('should reject nested delete of a read-only view from a table', () => {
      expect(() =>
        local.profile.find(1).update({
          activeUser: {
            // @ts-expect-error read-only view relation cannot delete
            delete: true,
          },
        }),
      ).toThrow(readOnlyError);
    });
  });
});
