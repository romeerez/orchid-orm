import {
  assertType,
  db,
  expectQueryNotMutated,
  expectSql,
  Message,
  Profile,
  profileData,
  Snake,
  snakeSelectAll,
  snakeSelectAllWithTable,
  User,
  userData,
  UserRecord,
  useTestDatabase,
} from '../test-utils/test-utils';
import { DateColumn, IntegerColumn, JSONTextColumn } from '../columns';
import { getShapeFromSelect } from './select';
import { UnknownColumn } from '../columns/unknown';

const insertUserAndProfile = async () => {
  const id = await User.get('id').create(userData);
  await Profile.create({ ...profileData, userId: id });
};

describe('select', () => {
  useTestDatabase();

  it('table should have all columns selected if select was not applied', () => {
    assertType<Awaited<typeof User>, UserRecord[]>();
  });

  describe('select', () => {
    it('should select all columns with a *', () => {
      const query = User.join(Message, 'authorId', 'id').select('*');

      assertType<Awaited<typeof query>, UserRecord[]>();

      expect(getShapeFromSelect(query)).toEqual(User.shape);

      expectSql(
        query.toSql(),
        `
          SELECT "user".* FROM "user"
          JOIN "message" ON "message"."authorId" = "user"."id"
        `,
      );
    });

    it('should select all named columns with a *', () => {
      const q = Snake.join(Message, 'authorId', 'tailLength').select('*');

      expectSql(
        q.toSql(),
        `
          SELECT ${snakeSelectAllWithTable} FROM "snake"
          JOIN "message" ON "message"."authorId" = "snake"."tail_length"
        `,
      );
    });

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

      expect(getShapeFromSelect(query)).toBe(User.shape);

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

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        name: User.shape.name,
      });

      expectQueryNotMutated(q);
    });

    it('should select named columns', () => {
      const q = Snake.select('snakeName', 'tailLength');

      expectSql(
        q.toSql(),
        `
          SELECT "snake"."snake_name" AS "snakeName", "snake"."tail_length" AS "tailLength"
          FROM "snake"
        `,
      );
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

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        name: User.shape.name,
      });

      expectQueryNotMutated(q);
    });

    it('should select named columns with table', () => {
      const q = Snake.select('snake.snakeName', 'snake.tailLength');

      expectSql(
        q.toSql(),
        `
          SELECT "snake"."snake_name" AS "snakeName", "snake"."tail_length" AS "tailLength"
          FROM "snake"
        `,
      );
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

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        userId: Profile.shape.userId,
      });

      expectQueryNotMutated(q);
    });

    it('should select named joined columns', () => {
      const q = User.join(Snake, 'tailLength', 'id').select(
        'user.id',
        'snake.snakeName',
      );

      expectSql(
        q.toSql(),
        `
          SELECT "user"."id", "snake"."snake_name" AS "snakeName"
          FROM "user"
          JOIN "snake" ON "snake"."tail_length" = "user"."id"
        `,
      );
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

      expect(getShapeFromSelect(query)).toEqual({
        id: User.shape.id,
        userId: Profile.shape.userId,
      });

      expectQueryNotMutated(q);
    });

    it('should select named joined columns with alias', () => {
      const q = User.join(Snake.as('s'), 'tailLength', 'id').select(
        'user.id',
        's.snakeName',
      );

      expectSql(
        q.toSql(),
        `
          SELECT "user"."id", "s"."snake_name" AS "snakeName"
          FROM "user"
          JOIN "snake" AS "s" ON "s"."tail_length" = "user"."id"
        `,
      );
    });

    describe('parse columns', () => {
      beforeEach(insertUserAndProfile);

      it('should parse columns of the table', async () => {
        const q = User.select('createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

        expect((await q.all())[0].createdAt instanceof Date).toBe(true);
        expect((await q.take()).createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0] instanceof Date).toBe(true);
        expect((await q.get('createdAt')) instanceof Date).toBe(true);
      });

      it('should parse columns of the table, selected by column name and table name', async () => {
        const q = User.select('user.createdAt');

        assertType<Awaited<typeof q>, { createdAt: Date }[]>();

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

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

        expect(getShapeFromSelect(q)).toEqual({
          createdAt: User.shape.createdAt,
        });

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

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedName: User.shape.name,
      });

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select named columns with aliases', async () => {
      const q = Snake.select({ name: 'snakeName', length: 'tailLength' });

      expectSql(
        q.toSql(),
        `
          SELECT "snake"."snake_name" AS "name", "snake"."tail_length" AS "length"
          FROM "snake"
        `,
      );
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

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedName: User.shape.name,
      });

      expectSql(
        query.toSql(),
        `
          SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should select named columns with table with aliases', async () => {
      const q = Snake.select({
        name: 'snake.snakeName',
        length: 'snake.tailLength',
      });

      expectSql(
        q.toSql(),
        `
          SELECT "snake"."snake_name" AS "name", "snake"."tail_length" AS "length"
          FROM "snake"
        `,
      );
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

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedUserId: Profile.shape.userId,
      });

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

    it('should select named joined columns with aliases', () => {
      const q = User.join(Snake, 'tailLength', 'id').select({
        userId: 'user.id',
        length: 'snake.tailLength',
      });

      expectSql(
        q.toSql(),
        `
          SELECT "user"."id" AS "userId", "snake"."tail_length" AS "length"
          FROM "user"
          JOIN "snake" ON "snake"."tail_length" = "user"."id"
        `,
      );
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

      expect(getShapeFromSelect(query)).toEqual({
        aliasedId: User.shape.id,
        aliasedUserId: Profile.shape.userId,
      });

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

    it('should select named joined columns with aliases from aliased join', () => {
      const q = User.join(Snake.as('s'), 'tailLength', 'id').select({
        userId: 'user.id',
        length: 's.tailLength',
      });

      expectSql(
        q.toSql(),
        `
          SELECT "user"."id" AS "userId", "s"."tail_length" AS "length"
          FROM "user"
          JOIN "snake" AS "s" ON "s"."tail_length" = "user"."id"
        `,
      );
    });

    it('should accept raw', () => {
      const q = User.all();
      const query = q.select({ one: db.raw('1') });

      assertType<Awaited<typeof query>, { one: unknown }[]>();

      expect(getShapeFromSelect(query)).toEqual({
        one: expect.any(UnknownColumn),
      });

      expectSql(
        query.toSql(),
        `
          SELECT 1 AS "one" FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw in a callback', () => {
      const query = User.select({
        one: (q) => q.raw((t) => t.integer(), '1'),
      });

      assertType<Awaited<typeof query>, { one: number }[]>();

      expect(getShapeFromSelect(query)).toEqual({
        one: expect.any(IntegerColumn),
      });

      expectSql(
        query.toSql(),
        `
          SELECT 1 AS "one" FROM "user"
        `,
      );
    });

    it('should select subquery', () => {
      const q = User.all();
      const query = q.select({ subquery: () => User.all() });

      assertType<Awaited<typeof query>, { subquery: UserRecord[] }[]>();

      expect(getShapeFromSelect(query)).toEqual({
        subquery: expect.any(JSONTextColumn),
      });

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

    it('should select subquery for named columns', () => {
      const q = Snake.select({ subquery: () => Snake.all() });

      expectSql(
        q.toSql(),
        `
          SELECT
            (
              SELECT COALESCE(json_agg(row_to_json("t".*)), '[]')
              FROM (
                SELECT ${snakeSelectAll}
                FROM "snake"
              ) AS "t"
            ) AS "subquery"
          FROM "snake"
        `,
      );
    });
  });

  describe('selectAll', () => {
    it('should select all columns', () => {
      const query = User.select('id', 'name').selectAll();

      assertType<Awaited<typeof query>, UserRecord[]>();

      expect(getShapeFromSelect(query)).toEqual(User.shape);

      expectSql(query.toSql(), `SELECT * FROM "user"`);
    });

    it('should select all named columns', () => {
      const q = Snake.select('snakeName').selectAll();

      expectSql(
        q.toSql(),
        `
          SELECT ${snakeSelectAll} FROM "snake"
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

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of the table, selected by column name and table name', async () => {
      const q = User.select({
        date: 'user.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse columns of joined table', async () => {
      const q = Profile.join(User, 'user.id', '=', 'profile.userId').select({
        date: 'user.createdAt',
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: User.shape.createdAt,
      });

      expect((await q.all())[0].date instanceof Date).toBe(true);
      expect((await q.take()).date instanceof Date).toBe(true);
      expect((await q.rows())[0][0] instanceof Date).toBe(true);
    });

    it('should parse raw column', async () => {
      const q = User.select({
        date: db.raw(
          () => new DateColumn({}).parse((input) => new Date(input)),
          '"createdAt"',
        ),
      });

      assertType<Awaited<typeof q>, { date: Date }[]>();

      expect(getShapeFromSelect(q)).toEqual({
        date: expect.any(DateColumn),
      });

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

        expect(getShapeFromSelect(q)).toEqual({
          users: expect.any(JSONTextColumn),
        });

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

        expect(getShapeFromSelect(q)).toEqual({
          user: expect.any(JSONTextColumn),
        });

        expect((await q.all())[0].user?.createdAt instanceof Date).toBe(true);
        expect((await q.take()).user?.createdAt instanceof Date).toBe(true);
        expect((await q.rows())[0][0]?.createdAt instanceof Date).toBe(true);
      });

      it('should parse subquery single value', async () => {
        const q = User.select({
          count: () => User.count(),
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

        expect((await q.all())[0].dates[0] instanceof Date).toBe(true);
        expect((await q.take()).dates[0] instanceof Date).toBe(true);
        expect((await q.rows())[0][0][0] instanceof Date).toBe(true);
      });
    });
  });
});
