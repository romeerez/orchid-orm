import {
  assertType,
  Chat,
  chatData,
  expectQueryNotMutated,
  expectSql,
  Message,
  messageData,
  MessageRecord,
  now,
  Profile,
  profileData,
  ProfileRecord,
  User,
  userData,
  UserRecord,
  useTestDatabase,
} from '../test-utils';
import { raw } from '../common';
import { columnTypes, DateColumn } from '../columnSchema';
import { addQueryOn } from './join';
import { RelationQuery, relationQueryKey } from '../relations';

const insertUserAndProfile = async () => {
  const id = await User.get('id').create(userData);
  await Profile.create({ ...profileData, userId: id });
};

describe('selectMethods', () => {
  useTestDatabase();

  it('table should have all columns selected if select was not applied', () => {
    assertType<Awaited<typeof User>, UserRecord[]>();
  });

  describe('select', () => {
    it('should have no effect if no columns provided', () => {
      const q = User.all();
      const query = q.select();

      assertType<Awaited<typeof q>, UserRecord[]>();

      expectSql(
        query.toSql(),
        `
          SELECT * FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select provided columns', () => {
      const q = User.all();
      const query = q.select('id', 'name');

      assertType<Awaited<typeof query>, Pick<UserRecord, 'id' | 'name'>[]>();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select table.column', () => {
      const q = User.all();
      const query = q.select('user.id', 'user.name');

      assertType<Awaited<typeof query>, Pick<UserRecord, 'id' | 'name'>[]>();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = User.all();
      const query = q
        .join(Profile, 'profile.userId', '=', 'user.id')
        .select('user.id', 'profile.userId');

      assertType<Awaited<typeof query>, { id: number; userId: number }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id", "profile"."userId" FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      const query = q
        .join(Profile.as('p'), 'p.userId', '=', 'user.id')
        .select('user.id', 'p.userId');

      assertType<Awaited<typeof query>, { id: number; userId: number }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id", "p"."userId" FROM "user"
          JOIN "profile" AS "p" ON "p"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    describe('select relation', () => {
      const profileQuery = Profile.takeOptional();
      const profileRelationQuery = addQueryOn(
        profileQuery,
        User,
        profileQuery,
        'userId',
        'id',
      );
      profileRelationQuery.query[relationQueryKey] = 'profile';

      const profileRelation = new Proxy(() => undefined, {
        get(_, key) {
          return (
            profileRelationQuery as unknown as Record<string | symbol, unknown>
          )[key];
        },
      }) as unknown as RelationQuery<
        'profile',
        Record<string, unknown>,
        never,
        typeof profileQuery
      >;

      it('should select relation which returns one record', () => {
        const q = User.all();

        const query = q.select('id', {
          profile: () => profileRelation.where({ bio: 'bio' }),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; profile: typeof Profile['type'] | null }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT row_to_json("t".*)
                FROM (
                  SELECT *
                  FROM "profile"
                  WHERE "profile"."userId" = "user"."id"
                    AND "profile"."bio" = $1
                  LIMIT $2
                ) AS "t"
              ) AS "profile"
            FROM "user"
          `,
          ['bio', 1],
        );

        expectQueryNotMutated(q);
      });

      it('should have proper type for required relation', () => {
        const q = User.all();

        const query = q.select('id', {
          profile: () =>
            profileRelation as unknown as RelationQuery<
              'profile',
              Record<string, unknown>,
              never,
              typeof profileRelationQuery,
              true
            >,
        });

        assertType<
          Awaited<typeof query>,
          { id: number; profile: typeof Profile['type'] }[]
        >();
      });

      it('should parse columns in single relation record result', async () => {
        const userId = await User.get('id').create(userData);
        const now = new Date();
        await Profile.create({ userId, updatedAt: now, createdAt: now });

        const [record] = await User.select('id', {
          profile: () => profileRelation,
        });

        assertType<
          typeof record,
          { id: number; profile: ProfileRecord | null }
        >();

        expect(record.profile).toMatchObject({
          updatedAt: now,
          createdAt: now,
        });
      });

      const messagesQuery = Message.as('messages');
      const messageRelationQuery = addQueryOn(
        messagesQuery,
        User,
        messagesQuery,
        'authorId',
        'id',
      );
      messageRelationQuery.query[relationQueryKey] = 'messages';

      const messageRelation = new Proxy(() => undefined, {
        get(_, key) {
          return (
            messageRelationQuery as unknown as Record<string | symbol, unknown>
          )[key];
        },
      }) as unknown as RelationQuery<
        'messages',
        Record<string, unknown>,
        never,
        typeof messageRelationQuery
      >;

      it('should select relation which returns many records', () => {
        const q = User.all();

        const query = q.select('id', {
          messages: () => messageRelation.where({ text: 'text' }),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; messages: typeof Message['type'][] }[]
        >();

        expectSql(
          query.toSql(),
          `
            SELECT
              "user"."id",
              (
                SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
                FROM (
                  SELECT *
                  FROM "message" AS "messages"
                  WHERE "messages"."authorId" = "user"."id"
                    AND "messages"."text" = $1
                ) AS "t"
              ) AS "messages"
            FROM "user"
          `,
          ['text'],
        );

        expectQueryNotMutated(q);
      });

      it('should parse columns in multiple relation records result', async () => {
        const { id: authorId } = await User.select('id').create(userData);
        const { id: chatId } = await Chat.select('id').create(chatData);
        await Message.create({
          authorId,
          chatId,
          ...messageData,
          createdAt: now,
          updatedAt: now,
        });

        const [record] = await User.select('id', {
          messages: () => messageRelation,
        });

        assertType<typeof record, { id: number; messages: MessageRecord[] }>();

        expect(record.messages[0]).toMatchObject({
          updatedAt: now,
          createdAt: now,
        });
      });

      it('should have proper type for conditional sub queries', async () => {
        const condition = true;

        const query = User.select('id', {
          hasProfile: condition
            ? () => profileRelation.exists()
            : raw(columnTypes.boolean(), 'true'),
        });

        assertType<
          Awaited<typeof query>,
          { id: number; hasProfile: boolean }[]
        >();
      });
    });

    describe('parse columns', () => {
      beforeEach(insertUserAndProfile);

      it('should parse columns of the table', async () => {
        const q = User.select('createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = User.select('user.createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('user.createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of joined table', async () => {
        const q = Profile.join(User, 'user.id', '=', 'profile.userId').select(
          'user.createdAt',
        );

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('user.createdAt')) instanceof Date).toBe(true);
      });
    });

    it('should select columns with aliases', async () => {
      const q = User.all();

      const query = q.select({ aliasedId: 'id', aliasedName: 'name' });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select table.column with aliases', () => {
      const q = User.all();

      const query = q.select({
        aliasedId: 'user.id',
        aliasedName: 'user.name',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = User.all();
      const query = q.join(Profile, 'profile.userId', '=', 'user.id').select({
        aliasedId: 'user.id',
        aliasedUserId: 'profile.userId',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id" AS "aliasedId", "profile"."userId" AS "aliasedUserId"
          FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      const query = q.join(Profile.as('p'), 'p.userId', '=', 'user.id').select({
        aliasedId: 'user.id',
        aliasedUserId: 'p.userId',
      });

      assertType<
        Awaited<typeof query>,
        { aliasedId: number; aliasedUserId: number }[]
      >();

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id" AS "aliasedId", "p"."userId" AS "aliasedUserId"
          FROM "user"
          JOIN "profile" AS "p" ON "p"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('can select raw', () => {
      const q = User.all();
      const query = q.select({ one: raw('1') });

      assertType<Awaited<typeof query>, { one: unknown }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT 1 AS "one" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('can select subquery', () => {
      const q = User.all();
      const query = q.select({ subquery: () => User.all() });

      assertType<Awaited<typeof query>, { subquery: UserRecord[] }[]>();

      expectSql(
        query.toSql(),
        `
          SELECT
            (
              SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
              FROM (SELECT * FROM "user") AS "t"
            ) AS "subquery"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('selectAll', () => {
    it('should select all columns', () => {
      const query = User.select('id', 'name').selectAll();

      assertType<Awaited<typeof query>, UserRecord[]>();

      expectSql(query.toSql(), `SELECT * FROM "user"`);
    });
  });

  describe('parse columns', () => {
    beforeEach(insertUserAndProfile);

    it('should parse columns of the table', async () => {
      const q = User.select({
        date: 'createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of the table, selected by column name and table name', async () => {
      const q = User.select({
        date: 'user.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of joined table', async () => {
      const q = Profile.join(User, 'user.id', '=', 'profile.userId').select({
        date: 'user.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse subquery array columns', async () => {
      const q = User.select({
        users: () => User.all(),
      });

      assertType<Awaited<typeof q>, { users: UserRecord[] }[]>();

      expect((await q.all())[0].users[0].createdAt instanceof Date).toBe(true);
      expect((await q.take()).users[0].createdAt instanceof Date).toBe(true);
      expect((await q.rows())[0][0][0].createdAt instanceof Date).toBe(true);
    });

    it('should parse subquery item columns', async () => {
      const q = User.select({
        user: () => User.take(),
      });

      assertType<Awaited<typeof q>, { user: UserRecord | null }[]>();

      expect((await q.all())[0].user?.createdAt instanceof Date).toBe(true);
      expect((await q.take()).user?.createdAt instanceof Date).toBe(true);
      expect((await q.rows())[0][0]?.createdAt instanceof Date).toBe(true);
    });

    it('should parse raw column', async () => {
      const q = User.select({
        date: raw(
          new DateColumn().parse((input) => new Date(input)),
          '"createdAt"',
        ),
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });
  });
});
