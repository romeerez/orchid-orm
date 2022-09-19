import {
  AssertEqual,
  Chat,
  chatData,
  expectQueryNotMutated,
  expectSql,
  Message,
  messageData,
  now,
  Profile,
  profileData,
  User,
  userData,
  useTestDatabase,
} from '../test-utils';
import { raw, rawColumn } from '../common';
import { DateColumn } from '../columnSchema';
import { addQueryOn } from './join';
import { RelationQuery, relationQueryKey } from '../relations';

const insertUserAndProfile = async () => {
  const id = await User.get('id').insert(userData);
  await Profile.insert({ ...profileData, userId: id });
};

describe('selectMethods', () => {
  useTestDatabase();

  describe('select', () => {
    it('should have no effect if no columns provided', () => {
      const q = User.all();
      expectSql(
        q.select().toSql(),
        `
          SELECT * FROM "user"
        `,
      );
      expectSql(
        q.select('id').select().toSql(),
        `
          SELECT "user"."id" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select provided columns', () => {
      const q = User.all();
      expectSql(
        q.select('id', 'name').toSql(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select table.column', () => {
      const q = User.all();
      expectSql(
        q.select('user.id', 'user.name').toSql(),
        `
          SELECT "user"."id", "user"."name" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns', () => {
      const q = User.all();

      expectSql(
        q
          .join(Profile, 'profile.userId', '=', 'user.id')
          .select('user.id', 'profile.userId')
          .toSql(),
        `
          SELECT "user"."id", "profile"."userId" FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select joined columns with alias', () => {
      const q = User.all();
      expectSql(
        q
          .join(Profile.as('p'), 'p.userId', '=', 'user.id')
          .select('user.id', 'p.userId')
          .toSql(),
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
        profileQuery,
        User,
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

        const query = q.select('id', profileRelation.where({ bio: 'bio' }));
        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profile: typeof Profile['type'] | null }[]
        > = true;
        expect(eq).toBe(true);

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

        const query = q.select(
          'id',
          profileRelation as unknown as RelationQuery<
            'profile',
            Record<string, unknown>,
            never,
            typeof profileRelationQuery,
            true
          >,
        );
        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; profile: typeof Profile['type'] }[]
        > = true;
        expect(eq).toBe(true);
      });

      it('should parse columns in single relation record result', async () => {
        const userId = await User.get('id').insert(userData);
        const now = new Date();
        await Profile.insert({ userId, updatedAt: now, createdAt: now });

        const [record] = await User.select('id', profileRelation);
        expect(record.profile).toMatchObject({
          updatedAt: now,
          createdAt: now,
        });
      });

      const messagesQuery = Message.as('messages');
      const messageRelationQuery = addQueryOn(
        messagesQuery,
        messagesQuery,
        User,
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

        const query = q.select('id', messageRelation.where({ text: 'text' }));
        const eq: AssertEqual<
          Awaited<typeof query>,
          { id: number; messages: typeof Message['type'][] }[]
        > = true;
        expect(eq).toBe(true);

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
        const { id: authorId } = await User.select('id').insert(userData);
        const { id: chatId } = await Chat.select('id').insert(chatData);
        await Message.insert({
          authorId,
          chatId,
          ...messageData,
        });

        const [record] = await User.select('id', messageRelation);
        expect(record.messages[0]).toMatchObject({
          updatedAt: now,
          createdAt: now,
        });
      });
    });

    describe('parse columns', () => {
      beforeEach(insertUserAndProfile);

      it('should parse columns of the table', async () => {
        const q = User.select('createdAt');

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = User.select('user.createdAt');

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('user.createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of joined table', async () => {
        const q = Profile.join(User, 'user.id', '=', 'profile.userId').select(
          'user.createdAt',
        );

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('user.createdAt')) instanceof Date).toBe(true);
      });
    });

    it('should select columns with aliases', async () => {
      const q = User.all();

      const query = q.select({ aliasedId: 'id', aliasedName: 'name' });

      const eq: AssertEqual<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      > = true;
      expect(eq).toBe(true);

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

      const eq: AssertEqual<
        Awaited<typeof query>,
        { aliasedId: number; aliasedName: string }[]
      > = true;
      expect(eq).toBe(true);

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
      expectSql(
        q
          .join(Profile, 'profile.userId', '=', 'user.id')
          .select({
            aliasedId: 'user.id',
            aliasedUserId: 'profile.userId',
          })
          .toSql(),
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
      expectSql(
        q
          .join(Profile.as('p'), 'p.userId', '=', 'user.id')
          .select({
            aliasedId: 'user.id',
            aliasedUserId: 'p.userId',
          })
          .toSql(),
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
      expectSql(
        q.select({ one: raw('1') }).toSql(),
        `
          SELECT 1 AS "one" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('can select subquery', () => {
      const q = User.all();
      expectSql(
        q.select({ subquery: User.all() }).toSql(),
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

      expectSql(query.toSql(), `SELECT * FROM "user"`);
    });
  });

  describe('parse columns', () => {
    beforeEach(insertUserAndProfile);

    it('should parse columns of the table', async () => {
      const q = User.select({
        date: 'createdAt',
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of the table, selected by column name and table name', async () => {
      const q = User.select({
        date: 'user.createdAt',
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of joined table', async () => {
      const q = Profile.join(User, 'user.id', '=', 'profile.userId').select({
        date: 'user.createdAt',
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse subquery array columns', async () => {
      const q = User.select({
        users: User.all(),
      });

      expect((await q.all())[0].users[0].createdAt instanceof Date).toBe(true);
      expect((await q.take()).users[0].createdAt instanceof Date).toBe(true);
      expect((await q.rows())[0][0][0].createdAt instanceof Date).toBe(true);
    });

    it('should parse subquery item columns', async () => {
      const q = User.select({
        user: User.take(),
      });

      expect((await q.all())[0].user.createdAt instanceof Date).toBe(true);
      expect((await q.take()).user.createdAt instanceof Date).toBe(true);
      expect((await q.rows())[0][0].createdAt instanceof Date).toBe(true);
    });

    it('should parse raw column', async () => {
      const q = User.select({
        date: rawColumn(
          new DateColumn().parse((input) => new Date(input)),
          '"createdAt"',
        ),
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });
  });
});
