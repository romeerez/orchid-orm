import {
  Chat,
  chatData,
  expectQueryNotMutated,
  Message,
  messageData,
  Product,
  Profile,
  profileData,
  ProfileRecord,
  Snake,
  snakeData,
  SnakeRecord,
  snakeSelectAll,
  snakeSelectAllWithTable,
  User,
  userColumnsSql,
  userData,
  UserRecord,
  userTableColumnsSql,
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
  db,
  expectSql,
  jsonBuildObjectAllSql,
  ProfileData,
  sql,
  testDb,
  testZodColumnTypes as t,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { z } from 'zod/v4';
import { NotFoundError } from '../../errors';
import { EmptyObject } from '../../../utils';
import { getShapeFromSelect } from './select.utils';

const insertUserAndProfile = async () => {
  const id = await User.get('id').create(userData);
  await Profile.create({ ...profileData, userId: id });
};

const profileJsonBuildObjectSql = jsonBuildObjectAllSql(Profile, 'p');

const ProfileNoParsers = Profile.clone();
ProfileNoParsers.q.parsers = undefined;

const createUserMessage = async () => {
  const userId = await User.get('id').insert(userData);
  const chatId = await Chat.get('idOfChat').insert(chatData);
  const message = await Message.create({
    ...messageData,
    chatId,
    authorId: userId,
  });
  return { message };
};

describe('select', () => {
  useTestDatabase();

  describe('select', () => {
    it('should select and parse all columns with a *', async () => {
      await createUserMessage();

      const q = User.join(Message, 'authorId', 'id').select('*');

      expect(Object.keys(getShapeFromSelect(q))).toEqual(
        Object.keys(User.q.selectAllShape),
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${userTableColumnsSql} FROM "schema"."user" "User"
          JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, UserRecord[]>();

      expect(res).toMatchObject([
        { name: userData.name, updatedAt: expect.any(Date) },
      ]);
    });

    it('should omit virtual columns from getShapeFromSelect when selecting *', () => {
      class Virtual extends VirtualColumn<DefaultSchemaConfig> {}

      const Table = Object.create(User);
      Table.q = {
        selectShape: {
          ...Table.shape,
          virtual: new Virtual(internalSchemaConfig),
        },
      };

      const q = Table.select('*');
      expect(Object.keys(getShapeFromSelect(q))).toEqual(
        Object.keys(User.q.selectAllShape),
      );
    });

    it('should select all named columns with a *', async () => {
      const { message } = await createUserMessage();
      await Snake.create({ ...snakeData, tailLength: message.authorId });

      const q = Snake.join(Message, 'authorId', 'tailLength').select('*');

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAllWithTable} FROM "schema"."snake" "Snake"
          JOIN "schema"."message" "Message" ON "Message"."author_id" = "Snake"."tail_length"
        `,
      );

      const res = await q;

      assertType<typeof res, SnakeRecord[]>();

      expect(res).toMatchObject([{ updatedAt: expect.any(Date) }]);
    });

    it('should select all table columns with * plus specified joined columns', async () => {
      await createUserMessage();

      const q = User.join(Message, 'authorId', 'id').select(
        '*',
        'Message.text',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${userTableColumnsSql}, "Message"."text" FROM "schema"."user" "User"
          JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, (UserRecord & { text: string })[]>();

      expect(res).toMatchObject([{ updatedAt: expect.any(Date) }]);
    });

    it('should be able to select nothing', async () => {
      await User.insert(userData);

      const q = User.select();

      expectSql(q.toSQL(), `SELECT FROM "schema"."user" "User"`);

      const users = await q;
      assertType<typeof users, EmptyObject[]>();

      expect(users).toEqual([{}]);
    });

    it('should select provided columns', () => {
      const q = User.all();
      const query = q.select('id', 'name');

      assertType<Awaited<typeof query>, Pick<UserRecord, 'id' | 'name'>[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id", "User"."name" FROM "schema"."user" "User"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        name: User.shape.name,
      });

      expectQueryNotMutated(q);
    });

    it('should select named columns', () => {
      const q = Snake.select('snakeName', 'tailLength');

      assertType<
        Awaited<typeof q>,
        { snakeName: string; tailLength: number }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "Snake"."snake_name" "snakeName", "Snake"."tail_length" "tailLength"
          FROM "schema"."snake" "Snake"
        `,
      );
    });

    it('should select table.column', () => {
      const q = User.all();
      const query = q.select('User.id', 'User.name');

      assertType<Awaited<typeof query>, Pick<UserRecord, 'id' | 'name'>[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id", "User"."name" FROM "schema"."user" "User"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        name: User.shape.name,
      });

      expectQueryNotMutated(q);
    });

    it('should select named columns with table', () => {
      const q = Snake.select('Snake.snakeName', 'Snake.tailLength');

      assertType<
        Awaited<typeof q>,
        { snakeName: string; tailLength: number }[]
      >();

      expectSql(
        q.toSQL(),
        `
          SELECT "Snake"."snake_name" "snakeName", "Snake"."tail_length" "tailLength"
          FROM "schema"."snake" "Snake"
        `,
      );
    });

    it('should select joined columns', () => {
      const q = User.all();
      const query = q
        .join(Profile, 'Profile.userId', '=', 'User.id')
        .select('User.id', 'Profile.userId');

      assertType<Awaited<typeof query>, { id: number; userId: number }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id", "Profile"."user_id" "userId" FROM "schema"."user" "User"
          JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        userId: Profile.shape.userId,
      });

      expectQueryNotMutated(q);
    });

    it('should select left joined columns as optional', () => {
      const q = User.leftJoin(Profile, 'Profile.userId', 'User.id').select(
        'User.id',
        'Profile.userId',
      );

      assertType<Awaited<typeof q>, { id: number; userId: number | null }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id", "Profile"."user_id" "userId" FROM "schema"."user" "User"
          LEFT JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
        `,
      );
    });

    it('should select named joined columns', () => {
      const q = User.join(Snake, 'tailLength', 'id').select(
        'User.id',
        'Snake.snakeName',
      );

      assertType<Awaited<typeof q>, { id: number; snakeName: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id", "Snake"."snake_name" "snakeName"
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "Snake" ON "Snake"."tail_length" = "User"."id"
        `,
      );
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      const query = q
        .join(Profile.as('p'), 'p.userId', '=', 'User.id')
        .select('User.id', 'p.userId');

      assertType<Awaited<typeof query>, { id: number; userId: number }[]>();

      expectSql(
        query.toSQL(),
        `
          SELECT "User"."id", "p"."user_id" "userId" FROM "schema"."user" "User"
          JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        userId: Profile.shape.userId,
      });

      expectQueryNotMutated(q);
    });

    it('should select named joined columns with alias', () => {
      const q = User.join(Snake.as('s'), 'tailLength', 'id').select(
        'User.id',
        's.snakeName',
      );

      assertType<Awaited<typeof q>, { id: number; snakeName: string }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id", "s"."snake_name" "snakeName"
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "s" ON "s"."tail_length" = "User"."id"
        `,
      );
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
        const q = User.select('createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]).toEqual(expect.any(Date));
        expect(await q.get('createdAt')).toEqual(expect.any(Date));
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = User.select('User.createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]).toEqual(expect.any(Date));
        expect(await q.get('User.createdAt')).toEqual(expect.any(Date));
      });

      it('should parse columns of joined table', async () => {
        const q = Profile.join(User, 'User.id', '=', 'Profile.userId').select(
          'User.createdAt',
        );

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]).toEqual(expect.any(Date));
        expect(await q.get('User.createdAt')).toEqual(expect.any(Date));
      });
    });

    it('should select columns with aliases', async () => {
      const q = User.all();

      const query = q.select({ aliasedId: 'id', aliasedName: 'name' });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedName: User.shape.name,
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

    it('should select named columns with aliases', async () => {
      const q = Snake.select({ name: 'snakeName', length: 'tailLength' });

      assertType<Awaited<typeof q>, { name: string; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "Snake"."snake_name" "name", "Snake"."tail_length" "length"
          FROM "schema"."snake" "Snake"
        `,
      );
    });

    it('should select table.column with aliases', () => {
      const q = User.all();

      const query = q.select({
        aliasedId: 'User.id',
        aliasedName: 'User.name',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedName: User.shape.name,
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

    it('should select named columns with table with aliases', async () => {
      const q = Snake.select({
        name: 'Snake.snakeName',
        length: 'Snake.tailLength',
      });

      assertType<Awaited<typeof q>, { name: string; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "Snake"."snake_name" "name", "Snake"."tail_length" "length"
          FROM "schema"."snake" "Snake"
        `,
      );
    });

    it('should select joined columns', () => {
      const q = User.all();
      const query = q.join(Profile, 'Profile.userId', '=', 'User.id').select({
        aliasedId: 'User.id',
        aliasedUserId: 'Profile.userId',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedUserId: Profile.shape.userId,
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

    it('should select named joined columns with aliases', () => {
      const q = User.join(Snake, 'tailLength', 'id').select({
        userId: 'User.id',
        length: 'Snake.tailLength',
      });

      assertType<Awaited<typeof q>, { userId: number; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "userId", "Snake"."tail_length" "length"
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "Snake" ON "Snake"."tail_length" = "User"."id"
        `,
      );
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      const query = q.join(Profile.as('p'), 'p.userId', '=', 'User.id').select({
        aliasedId: 'User.id',
        aliasedUserId: 'p.userId',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number }[]
      >();

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedUserId: Profile.shape.userId,
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

    it('should select named joined columns with aliases from aliased join', () => {
      const q = User.join(Snake.as('s'), 'tailLength', 'id').select({
        userId: 'User.id',
        length: 's.tailLength',
      });

      assertType<Awaited<typeof q>, { userId: number; length: number }[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."id" "userId", "s"."tail_length" "length"
          FROM "schema"."user" "User"
          JOIN "schema"."snake" "s" ON "s"."tail_length" = "User"."id"
        `,
      );
    });

    it('should accept raw', () => {
      const q = User.all();
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
      const q = User.select({
        count: sql<number>`count(*)`,
      }).select('name');

      assertType<Awaited<typeof q>, { count: number; name: string }[]>();
    });

    it('should respect previous select', () => {
      const q = User.select('id').select('name');

      assertType<Awaited<typeof q>, { id: number; name: string }[]>();
    });

    it('table should have all columns selected if select was not applied', () => {
      assertType<Awaited<typeof User>, UserRecord[]>();
    });

    describe('select callback', () => {
      it('should support conditional query or raw expression', async () => {
        const condition = true;
        const q = User.select({
          key: () => (condition ? User.exists() : sql<boolean>`false`),
        });

        assertType<Awaited<typeof q>, { key: boolean }[]>();
      });

      it('should accept raw in a callback', () => {
        const query = User.select({
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

      it('should select subquery', () => {
        const q = User.all();
        const query = q.select({ subquery: () => User.select('id') });

        assertType<Awaited<typeof query>, { subquery: { id: number }[] }[]>();

        expect(getShapeFromSelect(query)).toEqual({
          subquery: expect.any(JSONTextColumn),
        });

        expectSql(
          query.toSQL(),
          `
            SELECT
              (
                SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
                FROM (SELECT "User"."id" FROM "schema"."user" "User") "t"
              ) "subquery"
            FROM "schema"."user" "User"
          `,
        );

        expectQueryNotMutated(q);
      });

      it('should select subquery for named columns', () => {
        const q = Snake.select({ subquery: () => Snake.all() });

        assertType<Awaited<typeof q>, { subquery: SnakeRecord[] }[]>();

        expectSql(
          q.toSQL(),
          `
            SELECT
              (
                SELECT COALESCE(json_agg(row_to_json(t.*)), '[]')
                FROM (
                  SELECT ${snakeSelectAll}
                  FROM "schema"."snake" "Snake"
                ) "t"
              ) "subquery"
            FROM "schema"."snake" "Snake"
          `,
        );
      });

      it('should properly select and parse 3 levels deep select *', async () => {
        await User.insert(userData);

        const res = await User.select({
          arr: () =>
            User.select({
              arr: () => User.select('*'),
            }),
        });

        assertType<typeof res, { arr: { arr: UserRecord[] }[] }[]>();

        expect(res).toMatchObject([
          { arr: [{ arr: [{ updatedAt: expect.any(Date) }] }] },
        ]);
      });

      // testing this issue: https://github.com/romeerez/orchid-orm/issues/45
      // and this: https://github.com/romeerez/orchid-orm/issues/310
      it('should handle nested sub selects', async () => {
        await User.insert(userData);

        const res = await User.select('*', {
          author: () =>
            User.select({
              count: () => User.count(),
            }).takeOptional(),
        });

        assertType<
          typeof res,
          (UserRecord & { author: { count: number } | undefined })[]
        >();

        expect(res).toMatchObject([
          { updatedAt: expect.any(Date), author: { count: 1 } },
        ]);
      });

      it('should combine multiple selects and give proper types', async () => {
        const query = User.select('id').select({
          count: () => User.count(),
        });

        const q = User.from(query).selectAll();

        assertType<Awaited<typeof q>, { id: number; count: number }[]>();
      });

      it('should throw when sub query with `take` is not found', async () => {
        await User.insert(userData);

        await expect(() =>
          User.select({ as: () => Profile.take() }),
        ).rejects.toThrow(NotFoundError);
      });

      it('should return undefined when sub query with `takeOptional` is not found', async () => {
        await User.insert(userData);

        const res = await User.select({
          withParsers: () => Profile.takeOptional(),
          withoutParsers: () => ProfileNoParsers.takeOptional(),
        });

        assertType<
          typeof res,
          {
            withParsers: ProfileRecord | undefined;
            withoutParsers: ProfileRecord | undefined;
          }[]
        >();

        expect(res).toEqual([
          { withParsers: undefined, withoutParsers: undefined },
        ]);
      });

      it('should throw when sub query with `get` is not found', async () => {
        await User.insert(userData);

        await expect(() =>
          User.select({ as: () => Profile.get('id') }),
        ).rejects.toThrow(NotFoundError);
      });

      it('should not throw when not found for aggregations that can return null', async () => {
        await User.insert(userData);

        const res = await User.select({
          withParsers: () => Profile.avg('id'),
          withoutParsers: () => ProfileNoParsers.avg('id'),
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
  });

  describe('select implicit json', () => {
    it('should select joined table as json', async () => {
      await insertUserAndProfile();

      const q = User.join(Profile.as('p'), 'p.userId', 'User.id')
        .select('p.*')
        .where({
          'p.bio': profileData.bio,
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

      assertType<typeof res, { p: ProfileRecord }[]>();

      expect(res).toEqual([
        {
          p: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = User.join(Profile.as('p'), 'p.userId', 'User.id')
        .select({
          profile: 'p.*',
        })
        .where({
          'p.bio': profileData.bio,
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

      assertType<Awaited<typeof res>, { profile: ProfileRecord }[]>();

      expect(res).toEqual([
        {
          profile: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
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

      const q = User.join(Product.as('p'), 'p.userId', 'User.id').select('p.*');

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

      const q = User.leftJoin(Profile.as('p'), 'p.userId', 'User.id').select(
        'p.*',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          LEFT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, { p: ProfileRecord | undefined }[]>();

      expect(res).toEqual([
        {
          p: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select left joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = User.leftJoin(Profile.as('p'), 'p.userId', 'User.id').select({
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

      assertType<typeof res, { profile: ProfileRecord | undefined }[]>();

      expect(res).toEqual([
        {
          profile: {
            id: expect.any(Number),
            userId: expect.any(Number),
            bio: profileData.bio,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select right joined table as json', async () => {
      await insertUserAndProfile();

      const q = User.rightJoin(Profile.as('p'), 'p.userId', 'User.id').select(
        'name',
        'p.*',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name", ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          RIGHT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<typeof res, { name: string | null; p: ProfileRecord }[]>();

      expect(res).toEqual([
        {
          name: 'name',
          p: {
            ...profileData,
            id: expect.any(Number),
            userId: expect.any(Number),
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select right joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = User.rightJoin(Profile.as('p'), 'p.userId', 'User.id').select(
        'name',
        { profile: 'p.*' },
      );

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name", ${profileJsonBuildObjectSql} "profile"
          FROM "schema"."user" "User"
          RIGHT JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<
        typeof res,
        { name: string | null; profile: ProfileRecord }[]
      >();

      expect(res).toEqual([
        {
          name: 'name',
          profile: {
            ...profileData,
            id: expect.any(Number),
            userId: expect.any(Number),
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select full joined table as json', async () => {
      await insertUserAndProfile();

      const q = User.fullJoin(Profile.as('p'), 'p.userId', 'User.id').select(
        'name',
        'p.*',
      );

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name", ${profileJsonBuildObjectSql} "p"
          FROM "schema"."user" "User"
          FULL JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<
        typeof res,
        { name: string | null; p: ProfileRecord | undefined }[]
      >();

      expect(res).toEqual([
        {
          name: 'name',
          p: {
            ...profileData,
            id: expect.any(Number),
            userId: expect.any(Number),
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
          },
        },
      ]);
    });

    it('should select full joined table as json with alias', async () => {
      await insertUserAndProfile();

      const q = User.fullJoin(Profile.as('p'), 'p.userId', 'User.id').select(
        'name',
        { profile: 'p.*' },
      );

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name", ${profileJsonBuildObjectSql} "profile"
          FROM "schema"."user" "User"
          FULL JOIN "schema"."profile" "p" ON "p"."user_id" = "User"."id"
        `,
      );

      const res = await q;

      assertType<
        typeof res,
        { name: string | null; profile: ProfileRecord | undefined }[]
      >();

      expect(res).toEqual([
        {
          name: 'name',
          profile: {
            ...profileData,
            id: expect.any(Number),
            userId: expect.any(Number),
            updatedAt: expect.any(Date),
            createdAt: expect.any(Date),
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

      assertType<typeof res, { user: { Age: string | null } | undefined }[]>();

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
      const query = User.select('id', 'name').selectAll();

      assertType<Awaited<typeof query>, UserRecord[]>();

      expect(Object.keys(getShapeFromSelect(query))).toEqual(
        Object.keys(User.q.selectAllShape),
      );

      expectSql(
        query.toSQL(),
        `SELECT ${userColumnsSql} FROM "schema"."user" "User"`,
      );
    });

    it('should select all named columns', () => {
      const q = Snake.select('snakeName').selectAll();

      assertType<Awaited<typeof q>, SnakeRecord[]>();

      expectSql(
        q.toSQL(),
        `
          SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake"
        `,
      );
    });
  });

  describe('parse columns', () => {
    beforeEach(insertUserAndProfile);

    it('should parse columns of the table', async () => {
      const q = User.select({
        date: 'createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    it('should parse columns of the table, selected by column name and table name', async () => {
      const q = User.select({
        date: 'User.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    it('should parse columns of joined table', async () => {
      const q = Profile.join(User, 'User.id', '=', 'Profile.userId').select({
        date: 'User.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date).toEqual(expect.any(Date));
      expect((await q.take()).date).toEqual(expect.any(Date));
      expect((await q.rows())[0][0]).toEqual(expect.any(Date));
    });

    it('should parse raw column', async () => {
      const q = User.select({
        date: User.sql`"created_at"`.type(() =>
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
        const q = User.select({
          users: () => User.all(),
        });

        assertType<Awaited<typeof q>, { users: UserRecord[] }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          users: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].users[0].createdAt).toEqual(expect.any(Date));
        expect((await q.take()).users[0].createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0][0].createdAt).toEqual(expect.any(Date));
      });

      it('should parse subquery item columns', async () => {
        const q = User.select({
          user: () => User.takeOptional(),
        });

        assertType<Awaited<typeof q>, { user: UserRecord | undefined }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          user: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].user?.createdAt).toEqual(expect.any(Date));
        expect((await q.take()).user?.createdAt).toEqual(expect.any(Date));
        expect((await q.rows())[0][0]?.createdAt).toEqual(expect.any(Date));
      });

      it('should parse subquery single value', async () => {
        const q = User.select({
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
        const q = User.select({
          dates: () => User.pluck('createdAt'),
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
        const q = User.select({
          product: () => Product.take(),
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)
            FROM (SELECT "id", "camel_case" "camelCase", "price_amount" "priceAmount" FROM "schema"."product" "Product" LIMIT 1) "t"
          ) "product" FROM "schema"."user" "User" LIMIT 1`,
        );
      });

      it('should cast decimal to text for sub-selected records', () => {
        const q = User.select({
          products: () => Product,
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT (
            SELECT COALESCE(json_agg(json_build_object('id', t."id", 'camelCase', t."camelCase", 'priceAmount', t."priceAmount"::text)), '[]')
            FROM (SELECT "id", "camel_case" "camelCase", "price_amount" "priceAmount" FROM "schema"."product" "Product") "t"
          ) "products" FROM "schema"."user" "User" LIMIT 1`,
        );
      });

      it('should cast decimal to text for sub-selected records when selecting various columns', () => {
        const q = User.select({
          products: () => Product.select('id', 'camelCase', 'priceAmount'),
        }).take();

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
