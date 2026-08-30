import {
  expectQueryNotMutated,
  messageData,
  profileData,
} from '../../../test-utils/pqb.test-utils';
import {
  DateColumn,
  DefaultSchemaConfig,
  IntegerColumn,
  internalSchemaConfig,
  JSONTextColumn,
  VirtualColumn,
} from '../../../columns';
import {
  assertType,
  ChatData,
  db,
  expectSql,
  jsonBuildObjectAllSql,
  Profile,
  ProfileData,
  sql,
  testDb,
  testZodColumnTypes as t,
  UserData,
  UserDefaultSelect,
  UserSelectAll,
  UserSelectAllWithTable,
  useTestDatabase,
} from 'test-utils';
import { z } from 'zod/v4';
import { NotFoundError } from '../../errors';
import { EmptyObject } from '../../../utils';
import { getShapeFromSelect } from './select.utils';

type ProfileRow = {
  Id: number;
  ProfileKey: string;
  UserId: number | null;
  UserIdNoFkey: number | null;
  Bio: string | null;
  Active: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

const insertUserAndProfile = async () => {
  const id = await db.user.get('Id').create(UserData);
  await db.profile.create({
    Bio: profileData.bio,
    ProfileKey: 'key',
    UserId: id,
  });
};

const profileJsonBuildObjectSql = jsonBuildObjectAllSql(db.profile, 'p');

const ProfileNoParsers = db.profile.clone();
ProfileNoParsers.q.parsers = undefined;

const createUserMessage = async () => {
  const userId = await db.user.get('Id').insert(UserData);
  const chatId = await db.chat.get('IdOfChat').insert(ChatData);
  const message = await db.message.create({
    ...messageData,
    ChatId: chatId,
    AuthorId: userId,
  });
  return { message };
};

describe('select', () => {
  useTestDatabase();

  describe('select', () => {
    it('should select and parse all columns with a *', async () => {
      await createUserMessage();

      const q = db.user.join(db.message, 'AuthorId', 'Id').select('*');

      expect(Object.keys(getShapeFromSelect(q))).toEqual(
        Object.keys(db.user.q.selectAllShape),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable} FROM "schema"."user" "User"
          JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id" AND ("Message"."deleted_at" IS NULL)
        `,
      );

      const res = await q;

      assertType<typeof res, UserDefaultSelect[]>();

      expect(res).toMatchObject([
        { Name: UserData.Name, updatedAt: expect.any(Date) },
      ]);
    });

    it('should omit virtual columns from getShapeFromSelect when selecting *', () => {
      class Virtual extends VirtualColumn<DefaultSchemaConfig> {}

      const Table = Object.create(db.user);
      Table.q = {
        selectShape: {
          ...Table.shape,
          virtual: new Virtual(internalSchemaConfig),
        },
      };

      const q = Table.select('*');
      expect(Object.keys(getShapeFromSelect(q))).toEqual(
        Object.keys(db.user.q.selectAllShape),
      );
    });

    it('should select all table columns with * plus specified joined columns', async () => {
      await createUserMessage();

      const q = db.user
        .join(db.message, 'AuthorId', 'Id')
        .select('*', 'Message.Text');

      expectSql(
        q.toSQL(),
        `
          SELECT ${UserSelectAllWithTable}, "Message"."text" "Text" FROM "schema"."user" "User"
          JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id" AND ("Message"."deleted_at" IS NULL)
        `,
      );

      const res = await q;

      assertType<typeof res, (UserDefaultSelect & { Text: string })[]>();

      expect(res).toMatchObject([{ updatedAt: expect.any(Date) }]);
    });

    it('should be able to select nothing', async () => {
      await db.user.insert(UserData);

      const q = db.user.select();

      expectSql(q.toSQL(), `SELECT FROM "schema"."user" "User"`);

      const users = await q;
      assertType<typeof users, EmptyObject[]>();

      expect(users).toEqual([{}]);
    });

    it('should select provided columns', () => {
      const q = db.user.all();
      const query = q.select('Id', 'Name');

      assertType<
        Awaited<typeof query>,
        Pick<UserDefaultSelect, 'Id' | 'Name'>[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name" FROM "schema"."user" "User"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        Id: db.user.shape.Id,
        Name: db.user.shape.Name,
      });

      expectQueryNotMutated(q);
    });

    it('should select table.column', () => {
      const q = db.user.all();
      const query = q.select('User.Id', 'User.Name');

      assertType<
        Awaited<typeof query>,
        Pick<UserDefaultSelect, 'Id' | 'Name'>[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "Id", "User"."name" "Name" FROM "schema"."user" "User"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        Id: db.user.shape.Id,
        Name: db.user.shape.Name,
      });

      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = db.user.all();
      const query = q
        .join(db.profile, 'Profile.UserId', '=', 'User.Id')
        .select('User.Id', 'Profile.UserId');

      assertType<
        Awaited<typeof query>,
        { Id: number; UserId: number | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "Id", "Profile"."user_id" "UserId" FROM "schema"."user" "User"
          JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        Id: db.user.shape.Id,
        UserId: db.profile.shape.UserId,
      });

      expectQueryNotMutated(q);
    });

    it('should select left joined columns as optional', () => {
      const q = db.user
        .leftJoin(db.profile, 'Profile.UserId', 'User.Id')
        .select('User.Id', 'Profile.UserId');

      assertType<Awaited<typeof q>, { Id: number; UserId: number | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "Id", "Profile"."user_id" "UserId" FROM "schema"."user" "User"
          LEFT JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
      );
    });

    it('should select joined columns with alias', () => {
      const q = db.user.all();
      const query = q
        .join(db.profile.as('p'), 'p.UserId', '=', 'User.Id')
        .select('User.Id', 'p.UserId');

      assertType<
        Awaited<typeof query>,
        { Id: number; UserId: number | null }[]
      >();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "Id", "p"."user_id" "UserId" FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        Id: db.user.shape.Id,
        UserId: db.profile.shape.UserId,
      });

      expectQueryNotMutated(q);
    });

    it('should not apply table column parsers to a selected expression with the same name as a table column', async () => {
      await db.user.insert(UserData);

      const q = db.user.take().select({
        updatedAt: () => sql<boolean>`true`,
      });

      const res = await q;

      assertType<typeof res, { updatedAt: boolean }>();

      expect(res.updatedAt).toBe(true);
    });

    describe('loading records', () => {
      beforeEach(insertUserAndProfile);

      it('should parse columns of the table', async () => {
        const q = db.user.select('createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: db.user.shape.createdAt,
        });

        expect((await q.all())[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]).toEqual(expect.any(Date));
        expect(await q.get('createdAt')).toEqual(expect.any(Date));
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = db.user.select('User.createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: db.user.shape.createdAt,
        });

        expect((await q.all())[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]).toEqual(expect.any(Date));
        expect(await q.get('User.createdAt')).toEqual(expect.any(Date));
      });

      it('should parse columns of joined table', async () => {
        const q = db.profile
          .join(db.user, 'User.Id', '=', 'Profile.UserId')
          .select('User.createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: db.user.shape.createdAt,
        });

        expect((await q.all())[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]).toEqual(expect.any(Date));
        expect(await q.get('User.createdAt')).toEqual(expect.any(Date));
      });
    });

    it('should select columns with aliases', async () => {
      const q = db.user.all();

      const query = q.select({ aliasedId: 'Id', aliasedName: 'Name' });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: db.user.shape.Id,
        aliasedName: db.user.shape.Name,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "aliasedId", "User"."name" "aliasedName"
          FROM "schema"."user" "User"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select table.column with aliases', () => {
      const q = db.user.all();

      const query = q.select({
        aliasedId: 'User.Id',
        aliasedName: 'User.Name',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: db.user.shape.Id,
        aliasedName: db.user.shape.Name,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "aliasedId", "User"."name" "aliasedName"
          FROM "schema"."user" "User"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = db.user.all();
      const query = q
        .join(db.profile, 'Profile.UserId', '=', 'User.Id')
        .select({
          aliasedId: 'User.Id',
          aliasedUserId: 'Profile.UserId',
        });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number | null }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: db.user.shape.Id,
        aliasedUserId: db.profile.shape.UserId,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "aliasedId", "Profile"."user_id" "aliasedUserId"
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns with alias', () => {
      const q = db.user.all();
      const query = q
        .join(db.profile.as('p'), 'p.UserId', '=', 'User.Id')
        .select({
          aliasedId: 'User.Id',
          aliasedUserId: 'p.UserId',
        });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number | null }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: db.user.shape.Id,
        aliasedUserId: db.profile.shape.UserId,
      });

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id" "aliasedId", "p"."user_id" "aliasedUserId"
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw', () => {
      const q = db.user.all();
      const query = q.select({ one: sql`1` });

      assertType<Awaited<typeof query>, { one: unknown }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT 1 "one" FROM "schema"."user" "User"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should support selecting column after selecting by object', () => {
      const q = db.user
        .select({
          count: sql<number>`count(*)`,
        })
        .select('Name');

      assertType<Awaited<typeof q>, { count: number; Name: string }[]>();
    });

    it('should respect previous select', () => {
      const q = db.user.select('Id').select('Name');

      assertType<Awaited<typeof q>, { Id: number; Name: string }[]>();
    });

    it('table should have all columns selected if select was not applied', () => {
      assertType<Awaited<typeof db.user>, UserDefaultSelect[]>();
    });

    describe('select callback', () => {
      it('should support conditional query or raw expression', async () => {
        const condition = true;
        const q = db.user.select({
          key: () => (condition ? db.user.exists() : sql<boolean>`false`),
        });

        assertType<Awaited<typeof q>, { key: boolean }[]>();
      });

      it('should accept raw in a callback', () => {
        const query = db.user.select({
          one: () => sql`1`.type((t) => t.integer()),
        });

        assertType<Awaited<typeof query>, { one: number }[]>();

        expect(getShapeFromSelect(query)).toEqual({
          one: expect.any(IntegerColumn),
        });

        expectSql(
          query.toSQL(),
          `
            SELECT 1 "one" FROM "schema"."user" "User"
          `,
        );
      });

      it('should support callback returning sql.val', async () => {
        await db.user.insert(UserData);

        const q = db.user
          .select({
            null: () => sql.val(null),
          })
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT $1 "null" FROM "schema"."user" "User" LIMIT 1
          `,
          [null],
        );

        const res = await q;

        assertType<typeof res, { null: null }>();

        expect(res).toEqual({ null: null });
      });

      it('should select subquery', () => {
        const q = db.user.all();
        const query = q.select({ subquery: () => db.user.select('Id') });

        assertType<Awaited<typeof query>, { subquery: { Id: number }[] }[]>();

        expect(getShapeFromSelect(query)).toEqual({
          subquery: expect.any(JSONTextColumn),
        });

        expectSql(
          query.toSQL(),
          `
            SELECT
              (
                SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
                FROM (SELECT "User"."id" "Id" FROM "schema"."user" "User") "t"
              ) "subquery"
            FROM "schema"."user" "User"
          `,
        );

        expectQueryNotMutated(q);
      });

      it('should properly select and parse 3 levels deep select *', async () => {
        await db.user.insert(UserData);

        const res = await db.user.select({
          arr: () =>
            db.user.select({
              arr: () => db.user.select('*'),
            }),
        });

        assertType<typeof res, { arr: { arr: UserDefaultSelect[] }[] }[]>();

        expect(res).toMatchObject([
          { arr: [{ arr: [{ updatedAt: expect.any(Date) }] }] },
        ]);
      });

      // testing this issue: https://github.com/romeerez/orchid-orm/issues/45
      // and this: https://github.com/romeerez/orchid-orm/issues/310
      it('should handle nested sub selects', async () => {
        await db.user.insert(UserData);

        const res = await db.user.select('*', {
          author: () =>
            db.user
              .select({
                count: () => db.user.count(),
              })
              .takeOptional(),
        });

        assertType<
          typeof res,
          (UserDefaultSelect & { author: { count: number } | undefined })[]
        >();

        expect(res).toMatchObject([
          { updatedAt: expect.any(Date), author: { count: 1 } },
        ]);
      });

      it('should combine multiple selects and give proper types', async () => {
        const query = db.user.select('Id').select({
          count: () => db.user.count(),
        });

        const q = db.user.from(query).selectAll();

        assertType<Awaited<typeof q>, { Id: number; count: number }[]>();
      });

      it('should throw when sub query with `take` is not found', async () => {
        await db.user.insert(UserData);

        await expect(() =>
          db.user.select({ as: () => db.profile.take() }),
        ).rejects.toThrow(NotFoundError);
      });

      it('should return undefined when sub query with `takeOptional` is not found', async () => {
        await db.user.insert(UserData);

        const res = await db.user.select({
          withParsers: () => db.profile.takeOptional(),
          withoutParsers: () => ProfileNoParsers.takeOptional(),
        });

        assertType<
          typeof res,
          {
            withParsers: Profile | undefined;
            withoutParsers: Profile | undefined;
          }[]
        >();

        expect(res).toEqual([
          { withParsers: undefined, withoutParsers: undefined },
        ]);
      });

      it('should throw when sub query with `get` is not found', async () => {
        await db.user.insert(UserData);

        await expect(() =>
          db.user.select({ as: () => db.profile.get('Id') }),
        ).rejects.toThrow(NotFoundError);
      });

      it('should not throw when not found for aggregations that can return null', async () => {
        await db.user.insert(UserData);

        const res = await db.user.select({
          withParsers: () => db.profile.avg('Id'),
          withoutParsers: () => ProfileNoParsers.avg('Id'),
        });

        assertType<
          typeof res,
          {
            withParsers: number | null;
            withoutParsers: number | null;
          }[]
        >();

        expect(res).toEqual([{ withParsers: null, withoutParsers: null }]);
      });
    });

    it('should select relation with the same alias as a foreign key', async () => {
      const q = db.post.findOptional(0).select({
        UserId: (q) => q.user.get('Id'),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT "UserId"."UserId" "UserId"
          FROM "schema"."post" "Post"
          LEFT JOIN LATERAL (
            SELECT array["user"."id"] "UserId"
            FROM "schema"."user"
            WHERE "user"."id" = "Post"."user_id"
              AND "user"."user_key" = "Post"."title"
          ) "UserId" ON true
          WHERE "Post"."id" = $1
          LIMIT 1
        `,
        [0],
      );

      const res = await q;
      assertType<typeof res, { UserId: number } | undefined>();
    });
  });

  describe('select implicit json', () => {
    it('should select joined table as json', async () => {
      await insertUserAndProfile();

      const q = db.user
        .join(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select('p.*')
        .where({
          'p.Bio': profileData.bio,
        });

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
          WHERE "p"."bio" = $1
        `,
        [profileData.bio],
      );

      const res = await q;

      assertType<typeof res, { p: ProfileRow }[]>();

      expect(res).toEqual([
        {
          p: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = db.user
        .join(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select({
          profile: 'p.*',
        })
        .where({
          'p.Bio': profileData.bio,
        });

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "profile"
          FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
          WHERE "p"."bio" = $1
        `,
        [profileData.bio],
      );

      const res = await q;

      assertType<Awaited<typeof res>, { profile: ProfileRow }[]>();

      expect(res).toEqual([
        {
          profile: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select joined table with selectSql as json', () => {
      const Product = testDb('product', (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().name('user_id'),
        price: t.decimal().selectSql((column) => sql`trim_scale(${column})`),
      }));

      const q = db.user
        .join(Product.as('p'), 'p.userId', 'User.Id')
        .select('p.*');

      expectSql(
        q.toSQL(),
        `
          SELECT CASE WHEN to_jsonb("p") IS NULL THEN NULL ELSE json_build_object('id', "p"."id", 'userId', "p"."user_id", 'price', trim_scale("p"."price")::text) END "p"
          FROM "schema"."user" "User"
          JOIN "schema"."product" "p" ON "p"."user_id" = "User"."id"
        `,
      );
    });

    it('should select left joined table as json', async () => {
      await insertUserAndProfile();

      const q = db.user
        .leftJoin(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select('p.*');

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          LEFT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, { p: ProfileRow | undefined }[]>();

      expect(res).toEqual([
        {
          p: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select left joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = db.user
        .leftJoin(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select({
          profile: 'p.*',
        });

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "profile"
          FROM "schema"."user" "User"
          LEFT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, { profile: ProfileRow | undefined }[]>();

      expect(res).toEqual([
        {
          profile: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select right joined table as json', async () => {
      await insertUserAndProfile();

      const q = db.user
        .rightJoin(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select('Name', 'p.*');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name", ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          RIGHT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, { Name: string | null; p: ProfileRow }[]>();

      expect(res).toEqual([
        {
          Name: 'name',
          p: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select right joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = db.user
        .rightJoin(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select('Name', { profile: 'p.*' });

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name", ${profileJsonBuildObjectSql} "profile"
          FROM "schema"."user" "User"
          RIGHT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, { Name: string | null; profile: ProfileRow }[]>();

      expect(res).toEqual([
        {
          Name: 'name',
          profile: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select full joined table as json', async () => {
      await insertUserAndProfile();

      const q = db.user
        .fullJoin(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select('Name', 'p.*');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name", ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          FULL JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<
        typeof res,
        { Name: string | null; p: ProfileRow | undefined }[]
      >();

      expect(res).toEqual([
        {
          Name: 'name',
          p: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select full joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = db.user
        .fullJoin(db.profile.as('p'), 'p.UserId', 'User.Id')
        .select('Name', { profile: 'p.*' });

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name", ${profileJsonBuildObjectSql} "profile"
          FROM "schema"."user" "User"
          FULL JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<
        typeof res,
        { Name: string | null; profile: ProfileRow | undefined }[]
      >();

      expect(res).toEqual([
        {
          Name: 'name',
          profile: {
            Id: expect.any(Number),
            ProfileKey: expect.any(String),
            UserId: expect.any(Number),
            Bio: profileData.bio,
            Active: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select a single null value properly', async () => {
      await db.user.insert({
        ...UserData,
        profile: { create: ProfileData },
      });

      const res = await db.profile.select({
        user: (q) => q.user.select('Age'),
      });

      assertType<typeof res, { user: { Age: number | null } | undefined }[]>();

      expect(res).toEqual([{ user: { Age: null } }]);
    });

    it('should select nested relation of a missing optional relation', async () => {
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: null });

      const res = await db.profile.find(id).select({
        user: (q) =>
          q.user.select({
            profile: (q) => q.profile.select('Bio'),
          }),
      });

      assertType<
        typeof res,
        {
          user:
            | {
                profile: { Bio: string | null };
              }
            | undefined;
        }
      >();

      expect(res).toEqual({ user: undefined });
    });
  });

  describe('selectAll', () => {
    it('should select all columns', () => {
      const query = db.user.select('Id', 'Name').selectAll();

      assertType<Awaited<typeof query>, UserDefaultSelect[]>();

      expect(Object.keys(getShapeFromSelect(query))).toEqual(
        Object.keys(db.user.q.selectAllShape),
      );

      expectSql(
        query.toSQL(),
        `SELECT ${UserSelectAll} FROM "schema"."user" "User"`,
      );
    });
  });

  describe('parse columns', () => {
    beforeEach(insertUserAndProfile);

    it('should parse columns of the table', async () => {
      const q = db.user.select({
        date: 'createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: db.user.shape.createdAt,
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    it('should parse columns of the table, selected by column name and table name', async () => {
      const q = db.user.select({
        date: 'User.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: db.user.shape.createdAt,
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    it('should parse columns of joined table', async () => {
      const q = db.profile
        .join(db.user, 'User.Id', '=', 'Profile.UserId')
        .select({
          date: 'User.createdAt',
        });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: db.user.shape.createdAt,
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    it('should parse raw column', async () => {
      const q = db.user.select({
        date: db.user.sql`"created_at"`.type(() =>
          t.date().parse(z.date(), (input) => new Date(input)),
        ),
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: expect.any(DateColumn),
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    describe('sub query', () => {
      it('should parse subquery array columns', async () => {
        const q = db.user.select({
          users: () => db.user.all(),
        });

        assertType<Awaited<typeof q>, { users: UserDefaultSelect[] }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          users: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].users[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).users[0].createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0][0].createdAt).toEqual(expect.any(Date));
      });

      it('should parse subquery item columns', async () => {
        const q = db.user.select({
          user: () => db.user.takeOptional(),
        });

        assertType<
          Awaited<typeof q>,
          { user: UserDefaultSelect | undefined }[]
        >();

        expect(getShapeFromSelect(q)).toEqual({
          user: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].user?.createdAt).toEqual(expect.any(Date));
        expect((await q.take()).user?.createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]?.createdAt).toEqual(expect.any(Date));
      });

      it('should parse subquery single value', async () => {
        const q = db.user.select({
          count: (q) => q.count(),
        });

        assertType<Awaited<typeof q>, { count: number }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          count: expect.any(IntegerColumn),
        });

        expect(typeof (await q.all())[0].count).toBe('number');
        expect(typeof (await q.take()).count).toBe('number');
        expect(typeof (await q.rows())[0][0]).toBe('number');
      });

      it('should parse subquery pluck', async () => {
        const q = db.user.select({
          dates: () => db.user.pluck('createdAt'),
        });

        assertType<Awaited<typeof q>, { dates: Date[] }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          dates: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].dates[0]).toEqual(expect.any(Date));
        expect((await q.take()).dates[0]).toEqual(expect.any(Date));
        expect((await q.rows())[0][0][0]).toEqual(expect.any(Date));
      });

      it('should cast decimal to text for a sub-selected record', () => {
        const q = db.user
          .select({
            product: () => db.product.take(),
          })
          .take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)
            FROM (SELECT "id", "camel_case" "camelCase", "price_amount" "priceAmount" FROM "schema"."product" "Product" LIMIT 1) "t"
          ) "product" FROM "schema"."user" "User" LIMIT 1`,
        );
      });

      it('should cast decimal to text for sub-selected records', () => {
        const q = db.user
          .select({
            products: () => db.product,
          })
          .take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT COALESCE(json_agg(json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)), '[]')
            FROM (SELECT "id", "camel_case" "camelCase", "price_amount" "priceAmount" FROM "schema"."product" "Product") "t"
          ) "products" FROM "schema"."user" "User" LIMIT 1`,
        );
      });

      it('should cast decimal to text for sub-selected records when selecting various columns', () => {
        const q = db.user
          .select({
            products: () => db.product.select('id', 'camelCase', 'priceAmount'),
          })
          .take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT COALESCE(json_agg(json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)), '[]')
            FROM (SELECT "Product"."id", "Product"."camel_case" "camelCase", "Product"."price_amount" "priceAmount" FROM "schema"."product" "Product") "t"
          ) "products" FROM "schema"."user" "User" LIMIT 1`,
        );
      });
    });
  });
});
