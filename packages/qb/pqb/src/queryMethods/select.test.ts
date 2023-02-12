import {
  assertType,
  db,
  expectQueryNotMutated,
  expectSql,
  Profile,
  profileData,
  User,
  userData,
  UserRecord,
  useTestDatabase,
} from '../test-utils/test-utils';
import { DateColumn } from '../columns';

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
      const query = q.select({ one: db.raw('1') });

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
              FROM "user" AS "t"
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

    it('should parse raw column', async () => {
      const q = User.select({
        date: db.raw(
          () => new DateColumn().parse((input) => new Date(input)),
          '"createdAt"',
        ),
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    describe('sub query', () => {
      it('should parse subquery array columns', async () => {
        const q = User.select({
          users: () => User.all(),
        });

        assertType<Awaited<typeof q>, { users: UserRecord[] }[]>();

        expect((await q.all())[0].users[0].createdAt instanceof Date).toBe(
          true,
        );
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

      it('should parse subquery single value', async () => {
        const q = User.select({
          count: () => User.count(),
        });

        assertType<Awaited<typeof q>, { count: number }[]>();

        expect(typeof (await q.all())[0].count).toBe('number');
        expect(typeof (await q.take()).count).toBe('number');
        expect(typeof (await q.rows())[0][0]).toBe('number');
      });

      it('should parse subquery pluck', async () => {
        const q = User.select({
          dates: () => User.pluck('createdAt'),
        });

        assertType<Awaited<typeof q>, { dates: Date[] }[]>();

        expect((await q.all())[0].dates[0] instanceof Date).toBe(true);
        expect((await q.take()).dates[0] instanceof Date).toBe(true);
        expect((await q.rows())[0][0][0] instanceof Date).toBe(true);
      });
    });
  });
});
