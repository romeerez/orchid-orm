import { useTestORM } from '../test-utils/orm.test-utils';
import {
  assertType,
  db,
  expectSql,
  ProfileData,
  sql,
  testAdapter,
  UserData,
} from 'test-utils';
import {
  bundleOrchidORM,
  makeOrchidOrmDbWithAdapter,
  orchidORMWithAdapter,
  setGrants,
} from '../orm';
import { BaseTable } from 'test-utils';
import { CannotMutateReadOnlyTableError } from 'pqb/internal';

describe('view', () => {
  useTestORM();

  it('should be queryable just as normal table', async () => {
    await db.user.createMany([
      {
        ...UserData,
        Active: false,
        profile: {
          create: ProfileData,
        },
      },
      {
        ...UserData,
        Active: true,
        profile: {
          create: ProfileData,
        },
      },
    ]);

    const count = await db.$views.activeUserWithProfile.count();
    expect(count).toBe(1);
  });

  it('should expose first-class views under $views with read-only default', () => {
    const query = db.$views.activeUser.select('id', 'name').where({ id: 1 });

    assertType<typeof db.$views.activeUser.__readOnly, true>();
    assertType<Awaited<typeof query>, { id: number; name: string }[]>();

    expectSql(
      query.toSQL(),
      `
        SELECT "activeUser"."id", "activeUser"."name"
        FROM "schema"."activeUser"
        WHERE "activeUser"."id" = $1
      `,
      [1],
    );

    expect(() =>
      // @ts-expect-error first-class views are read-only by default
      db.$views.activeUser.create({ id: 1, name: 'name' }),
    ).toThrow(CannotMutateReadOnlyTableError);
  });

  it('should allow writable views when readOnly is false', () => {
    assertType<typeof db.$views.writableActiveUser.__readOnly, undefined>();

    expect(() =>
      db.$views.writableActiveUser.create({
        name: 'name',
        password: 'pw',
      }),
    ).not.toThrow(CannotMutateReadOnlyTableError);
  });

  it('should expose materialized views under $views as read-only materialized queries', () => {
    class MonthlySalesView extends BaseTable.MaterializedView {
      schema = 'analytics';
      readonly name = 'monthlySales';
      withData = false;
      columns = this.setColumns((t) => ({
        userId: t.integer(),
        month: t.date(),
        total: t.decimal(),
      }));
      grants = setGrants([
        {
          to: 'reader',
          select: true,
        },
      ]);

      sql = BaseTable.sql`SELECT "userId", "month", "total" FROM "sale"`;
    }

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          monthlySales: MonthlySalesView,
        },
      },
      {},
    );

    const query = local.$views.monthlySales
      .select('userId', 'month')
      .where({ userId: 1 });

    assertType<typeof local.$views.monthlySales.__readOnly, true>();
    assertType<typeof local.$views.monthlySales.__materialized, true>();
    assertType<typeof query.__materialized, true>();

    expectSql(
      query.toSQL(),
      `
        SELECT "monthlySales"."user_id" "userId", "monthlySales"."month"
        FROM "analytics"."monthly_sales" "monthlySales"
        WHERE "monthlySales"."user_id" = $1
      `,
      [1],
    );

    expect(local.$views.monthlySales.internal.materialized).toBe(true);
    expect(local.$views.monthlySales.internal.tableGrants).toEqual([
      {
        to: 'reader',
        select: true,
      },
    ]);
    expect(() =>
      // @ts-expect-error materialized views are always read-only
      local.$views.monthlySales.create({
        userId: 1,
        month: new Date(),
        total: '1',
      }),
    ).toThrow(CannotMutateReadOnlyTableError);
  });

  it('should keep materialized views read-only even when readOnly is false', () => {
    class CannotBeReadOnly extends BaseTable.MaterializedView {
      // @ts-expect-error materialized views cannot opt into writes
      readonly readOnly = false;
    }
    expect(CannotBeReadOnly);

    class WritableAttemptView extends BaseTable.MaterializedView {
      readonly name = 'writableAttempt';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));

      sql = BaseTable.sql`SELECT id FROM "user"`;
    }

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          writableAttempt: WritableAttemptView,
        },
      },
      {},
    );

    assertType<typeof local.$views.writableAttempt.__readOnly, true>();
    expect(() =>
      // @ts-expect-error materialized views are always read-only
      local.$views.writableAttempt.create({ id: 1 }),
    ).toThrow(CannotMutateReadOnlyTableError);
  });

  it('should expose materialized views in split ORM setup', () => {
    class BundleActiveUserView extends BaseTable.MaterializedView {
      readonly name = 'activeUser';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));

      sql = BaseTable.sql`SELECT id FROM "user"`;
    }

    const orm = bundleOrchidORM({
      views: {
        activeUser: BundleActiveUserView,
      },
    });
    const local = makeOrchidOrmDbWithAdapter(orm, { adapter: testAdapter });

    assertType<typeof local.$views.activeUser.__materialized, true>();
    expect(Object.keys(orm)).toEqual(['$views']);
    expect(Object.keys(orm.$views)).toEqual(['activeUser']);
    expect(orm.$views.activeUser.table).toBe('activeUser');
    expectSql(
      local.$views.activeUser.select('id').toSQL(),
      `
        SELECT "activeUser"."id"
        FROM "active_user" "activeUser"
      `,
    );
  });

  it('should reject duplicate database names across tables and views', () => {
    class UserTable extends BaseTable.View {
      schema = 'custom';
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        id: t.integer().primaryKey(),
      }));
    }

    class DuplicateUserView extends BaseTable.View {
      schema = 'custom';
      readonly name = 'user';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`SELECT id FROM "user"`;
    }

    expect(() =>
      orchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            user: DuplicateUserView,
          },
        },
        {
          user: UserTable,
        },
      ),
    ).toThrow(
      'Cannot configure both a table and a view for database relation custom.user',
    );
  });

  it('should reject duplicate database names across tables and materialized views', () => {
    class UserTable extends BaseTable {
      schema = 'custom';
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        id: t.integer().primaryKey(),
      }));
    }

    class DuplicateUserView extends BaseTable.MaterializedView {
      schema = 'custom';
      readonly name = 'user';
      columns = this.setColumns((t) => ({
        id: t.integer(),
      }));
      sql = BaseTable.sql`SELECT id FROM "user"`;
    }

    expect(() =>
      orchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            user: DuplicateUserView,
          },
        },
        {
          user: UserTable,
        },
      ),
    ).toThrow(
      'Cannot configure both a table and a view for database relation custom.user',
    );
  });

  describe('scopes', () => {
    class ScopedActiveUserView extends BaseTable.View {
      readonly name = 'activeUser';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        active: t.boolean(),
      }));

      scopes = this.setScopes({
        default: (q) => q.where({ active: true }),
        positiveId: (q) => q.where({ id: { gt: 0 } }),
      });

      sql = BaseTable.sql`SELECT * FROM "schema"."user" WHERE "active"`;
    }

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          activeUser: ScopedActiveUserView,
        },
      },
      {},
    );

    it('should have a default scope and be able to use defined scope', () => {
      expectSql(
        local.$views.activeUser.scope('positiveId').toSQL(),
        `
          SELECT * FROM "active_user" "activeUser"
          WHERE ("activeUser"."active" = $1)
            AND ("activeUser"."id" > $2)
        `,
        [true, 0],
      );
    });
  });

  describe('computed', () => {
    class ComputedActiveUserView extends BaseTable.View {
      schema = () => 'schema';
      readonly name = 'activeUser';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        active: t.boolean(),
      }));

      computed = this.setComputed((q) => ({
        sqlComputed: sql<string>`upper(${q.column('name')})`,
        runtimeComputed: q.computeAtRuntime(
          ['name', 'active'],
          (record) => `${record.name}:${record.active}`,
        ),
      }));

      sql = BaseTable.sql`SELECT "id", "name" FROM "schema"."user"`;
    }

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          activeUser: ComputedActiveUserView,
        },
      },
      {},
    );

    it('should select computed columns', async () => {
      await db.user.insert({ ...UserData, Active: true });

      const query = local.$views.activeUser.select(
        'sqlComputed',
        'runtimeComputed',
      );

      const res = await query;

      assertType<
        typeof res,
        { sqlComputed: string; runtimeComputed: string }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT (upper("activeUser"."name")) "sqlComputed",
            "activeUser"."name",
            "activeUser"."active"
          FROM "schema"."active_user" "activeUser"
        `,
      );

      expect(res).toEqual([
        {
          sqlComputed: 'NAME',
          runtimeComputed: 'name:true',
        },
      ]);
    });
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
                SELECT 1 FROM "schema"."chatUser"
                WHERE "chatUser"."chat_id" = "chats"."id_of_chat"
                  AND "chatUser"."user_id" = "activeUser"."id"
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
      class LocalActiveUserView extends BaseTable.View {
        readonly name = 'activeUser';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));

        sql = BaseTable.sql`SELECT "id" FROM "schema"."user"`;
      }

      class MissingUserTable extends BaseTable {
        readonly table = 'missingUser';
        columns = this.setColumns((t) => ({
          Id: t.name('id').identity().primaryKey(),
        }));

        relations = {
          activeUser: this.hasOne(() => LocalActiveUserView, {
            columns: ['Id'],
            references: ['id'],
          }),
        };
      }

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
      class LocalUserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));

        relations = {
          activeUser: this.hasOne(() => LocalActiveUserView, {
            columns: ['id'],
            references: ['id'],
          }),
        };
      }

      class LocalActiveUserView extends BaseTable.MaterializedView {
        readonly name = 'activeUser';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));

        relations = {
          user: this.belongsTo(() => LocalUserTable, {
            columns: ['id'],
            references: ['id'],
          }),
        };

        sql = BaseTable.sql`SELECT "id" FROM "user"`;
      }

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

    class LocalActiveUserView extends BaseTable.View {
      readonly name = 'activeUser';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      sql = BaseTable.sql`SELECT "id", "name", "password" FROM "schema"."user"`;
    }

    class LocalWritableActiveUserView extends BaseTable.View {
      readonly id = 'writableActiveUser';
      readonly name = 'activeUser';
      readonly readOnly = false;
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));

      sql = BaseTable.sql`SELECT "id", "name", "password" FROM "schema"."user"`;
    }

    class LocalProfileTable extends BaseTable {
      readonly table = 'profile';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        activeUserId: t.integer().nullable(),
        writableActiveUserId: t.integer().nullable(),
        bio: t.text().nullable(),
      }));

      relations = {
        writableActiveUser: this.belongsTo(() => LocalWritableActiveUserView, {
          columns: ['writableActiveUserId'],
          references: ['id'],
        }),
        activeUser: this.belongsTo(() => LocalActiveUserView, {
          columns: ['activeUserId'],
          references: ['id'],
        }),
      };
    }

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
