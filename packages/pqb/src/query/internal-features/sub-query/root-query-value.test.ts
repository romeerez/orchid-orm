import {
  assertType,
  db,
  expectSql,
  UserData,
  testDb,
  UserSelectAll,
  useTestDatabase,
} from 'test-utils';
import { NotFoundError } from '../../errors';

const ScopedUser = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    active: t.boolean().nullable(),
    deletedAt: t.timestamp().nullable(),
  }),
  undefined,
  {
    scopes: {
      default: (q) => q.where({ deletedAt: null }),
      active: (q) => q.where({ active: true }),
    },
  },
);

describe('root query value', () => {
  useTestDatabase();

  const insertUsers = () =>
    db.user.insertMany([
      { ...UserData, Name: 'Alice', Age: 20, Active: true },
      { ...UserData, Name: 'Bob', Active: true },
    ]);

  describe('select', () => {
    it('should apply conditions added to the root query to `exists` of the current record', async () => {
      await insertUsers();

      const isAlice = db.user.makeHelper((q) => q.where({ Name: 'Alice' }));

      const q = db.user
        .select('Name', {
          isAlice: (q) => q.useHelper(isAlice).exists(),
          isNotAlice: (q) => q.where({ Name: 'Alice' }).notExists(),
        })
        .order('Name');

      expectSql(
        q.toSQL(),
        `
          SELECT
            "User"."name" "Name",
            CASE WHEN "User"."name" = $1 THEN true ELSE false END "isAlice",
            CASE WHEN "User"."name" = $2 THEN false ELSE true END "isNotAlice"
          FROM "schema"."user" "User"
          ORDER BY "User"."name" ASC
        `,
        ['Alice', 'Alice'],
      );

      const res = await q;

      assertType<
        typeof res,
        { Name: string; isAlice: boolean; isNotAlice: boolean }[]
      >();

      expect(res).toEqual([
        { Name: 'Alice', isAlice: true, isNotAlice: false },
        { Name: 'Bob', isAlice: false, isNotAlice: true },
      ]);
    });

    it('should return `false` from `exists` and `true` from `notExists` when the conditions are unknown for the current record', async () => {
      await db.user.insertMany([
        { ...UserData, Name: 'Alice', Active: true },
        { ...UserData, Name: 'Bob', Active: null },
      ]);

      const res = await db.user
        .select('Name', {
          exists: (q) => q.where({ Active: true }).exists(),
          notExists: (q) => q.where({ Active: true }).notExists(),
        })
        .order('Name');

      expect(res).toEqual([
        { Name: 'Alice', exists: true, notExists: false },
        { Name: 'Bob', exists: false, notExists: true },
      ]);
    });

    it('should not repeat conditions of the root query', () => {
      const q = db.user.where({ Active: true }).select({
        isAlice: (q) => q.where({ Name: 'Alice' }).exists(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT CASE WHEN "User"."name" = $1 THEN true ELSE false END "isAlice"
          FROM "schema"."user" "User"
          WHERE "User"."active" = $2
        `,
        ['Alice', true],
      );
    });

    it('should apply a scope added to the root query, and not repeat scopes of the root query', () => {
      const q = ScopedUser.select({
        isActive: (q) => q.scope('active').exists(),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT CASE WHEN ("user"."active" = $1) THEN true ELSE false END "isActive"
          FROM "schema"."user"
          WHERE ("user"."deleted_at" IS NULL)
        `,
        [true],
      );
    });

    it('should apply all conditions of the root query when `orWhere` is added', async () => {
      await insertUsers();

      const q = db.user
        .where({ Name: 'Bob' })
        .select({ x: (q) => q.orWhere({ Name: 'Alice' }).exists() });

      expectSql(
        q.toSQL(),
        `
          SELECT
            CASE WHEN "User"."name" = $1 OR "User"."name" = $2 THEN true ELSE false END "x"
          FROM "schema"."user" "User"
          WHERE "User"."name" = $3
        `,
        ['Bob', 'Alice', 'Bob'],
      );

      expect(await q).toEqual([{ x: true }]);
    });

    it('should apply all conditions of the root query when it has `orWhere`, or when a scope is added with `orWhere`', () => {
      expectSql(
        db.user
          .where({ Name: 'Alice' })
          .orWhere({ Name: 'Bob' })
          .select({ x: (q) => q.where({ Active: true }).exists() })
          .toSQL(),
        `
          SELECT
            CASE WHEN "User"."name" = $1 AND "User"."active" = $2 OR "User"."name" = $3 THEN true ELSE false END "x"
          FROM "schema"."user" "User"
          WHERE "User"."name" = $4 OR "User"."name" = $5
        `,
        ['Alice', true, 'Bob', 'Alice', 'Bob'],
      );

      expectSql(
        ScopedUser.where({ name: 'Bob' })
          .select({
            x: (q) => q.scope('active').orWhere({ name: 'Alice' }).exists(),
          })
          .toSQL(),
        `
          SELECT
            CASE WHEN ("user"."name" = $1 OR "user"."name" = $2) AND ("user"."active" = $3) THEN true ELSE false END "x"
          FROM "schema"."user"
          WHERE ("user"."name" = $4) AND ("user"."deleted_at" IS NULL)
        `,
        ['Bob', 'Alice', true, 'Bob'],
      );
    });

    it('should return a value of `getOptional` when the current record matches the conditions, `undefined` otherwise, and a found `null`', async () => {
      await insertUsers();

      const q = db.user
        .select('Name', {
          age: (q) => q.where({ Active: true }).getOptional('Age'),
          aliceAge: (q) => q.where({ Name: 'Alice' }).getOptional('Age'),
        })
        .order('Name');

      expectSql(
        q.toSQL(),
        `
          SELECT
            "User"."name" "Name",
            CASE WHEN "User"."active" = $1 THEN array["User"."age"] END "age",
            CASE WHEN "User"."name" = $2 THEN array["User"."age"] END "aliceAge"
          FROM "schema"."user" "User"
          ORDER BY "User"."name" ASC
        `,
        [true, 'Alice'],
      );

      const res = await q;

      assertType<
        typeof res,
        {
          Name: string;
          age: number | null | undefined;
          aliceAge: number | null | undefined;
        }[]
      >();

      expect(res).toEqual([
        { Name: 'Alice', age: 20, aliceAge: 20 },
        { Name: 'Bob', age: null, aliceAge: undefined },
      ]);
    });

    it('should throw `NotFoundError` for `get` when the current record does not match the conditions', async () => {
      await insertUsers();

      const q = db.user.select({
        name: (q) => q.where({ Name: 'Alice' }).get('Name'),
      });

      await expect(q).rejects.toThrow(NotFoundError);

      const res = await q.where({ Name: 'Alice' });

      assertType<typeof res, { name: string }[]>();

      expect(res).toEqual([{ name: 'Alice' }]);
    });

    it('should apply conditions to a value used in the `and` operator, the value is `NULL` for a record that does not match them', async () => {
      await db.user.insertMany([
        { ...UserData, Name: 'Alice', Age: 20, Active: true },
        { ...UserData, Name: 'Bob', Age: 30, Active: true },
      ]);

      const q = db.user
        .select('Name', {
          x: (q) =>
            q.get('Active').and(q.where({ Name: 'Alice' }).get('Age').gt(18)),
        })
        .order('Name');

      expectSql(
        q.toSQL(),
        `
          SELECT
            "User"."name" "Name",
            "User"."active" AND CASE WHEN "User"."name" = $2 THEN "User"."age" > $1 END "x"
          FROM "schema"."user" "User"
          ORDER BY "User"."name" ASC
        `,
        [18, 'Alice'],
      );

      expect(await q).toEqual([
        { Name: 'Alice', x: true },
        { Name: 'Bob', x: null },
      ]);
    });

    it('should throw for `ref` and `column` after conditions are added to the root query, suggesting `get` or `getOptional`', () => {
      const error =
        'after adding conditions to the root query in a callback, use `get` or `getOptional` instead';

      expect(() =>
        db.user.select({ x: (q) => q.where({ Name: 'Alice' }).ref('Name') }),
      ).toThrow(`Cannot use \`ref\` ${error}`);

      expect(() =>
        ScopedUser.select({ x: (q) => q.scope('active').column('name') }),
      ).toThrow(`Cannot use \`column\` ${error}`);

      expect(() =>
        db.user.where((q) =>
          q.where({ Name: 'Alice' }).ref('Active').equals(true),
        ),
      ).toThrow(`Cannot use \`ref\` ${error}`);
    });

    it('should throw for an aggregate, suggesting its `filter` option', () => {
      expect(() =>
        db.user.select({ x: (q) => q.where({ Name: 'Alice' }).count() }),
      ).toThrow(
        'Cannot apply conditions added to the root query in a callback to the aggregate `count`, use its `filter` option instead',
      );
    });

    it('should apply conditions to an arbitrary SQL function called with `fn`', () => {
      const q = db.user.select({
        x: (q) =>
          q
            .where({ Active: true })
            .fn('lower', ['Name'])
            .type((t) => t.text()),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT CASE WHEN "User"."active" = $1 THEN array[lower("User"."name")] END "x"
          FROM "schema"."user" "User"
        `,
        [true],
      );
    });

    it('should apply conditions to an aggregate called with `fn` for the current group, and throw `NotFoundError` for a group that does not match them', async () => {
      await db.user.insertMany([
        { ...UserData, Name: 'Alice' },
        { ...UserData, Name: 'Alice' },
        { ...UserData, Name: 'Bob' },
      ]);

      const q = db.user
        .select('Name', {
          aliceCount: (q) =>
            q
              .where({ Name: 'Alice' })
              .fn('count', ['*'])
              .type((t) => t.bigint()),
        })
        .group('Name')
        .order('Name');

      expectSql(
        q.toSQL(),
        `
          SELECT
            "User"."name" "Name",
            CASE WHEN "User"."name" = $1 THEN array[count(*)] END "aliceCount"
          FROM "schema"."user" "User"
          GROUP BY "User"."name"
          ORDER BY "User"."name" ASC
        `,
        ['Alice'],
      );

      // like `get`, the group of Bob doesn't match the conditions
      await expect(q).rejects.toThrow(NotFoundError);

      expect(await q.where({ Name: 'Alice' })).toEqual([
        { Name: 'Alice', aliceCount: '2' },
      ]);
    });

    it('should throw for a join or `limit` added to the root query, also for `ref` and `column`', () => {
      expect(() =>
        db.user.select({ x: (q) => q.join('profile').exists() }),
      ).toThrow(
        'Cannot apply `join` added to the root query in a callback to the value of the current record',
      );

      expect(() =>
        db.user.select({ x: (q) => q.limit(1).ref('Active') }),
      ).toThrow(
        'Cannot apply `limit` added to the root query in a callback to the value of the current record',
      );

      expect(() =>
        db.user.select({
          x: (q) =>
            q.get('Active').and(q.limit(1).column('Active').equals(true)),
        }),
      ).toThrow(
        'Cannot apply `limit` added to the root query in a callback to the value of the current record',
      );
    });

    it('should throw for a relation of the root query with added conditions', () => {
      expect(() =>
        db.user.select({
          x: (q) => q.where({ Name: 'Alice' }).profile.exists(),
        }),
      ).toThrow(
        'Cannot use a relation after adding conditions or other query parts to the root query in a callback',
      );
    });
  });

  describe('where', () => {
    it('should apply conditions added to the root query to a value of the current record', async () => {
      await insertUsers();

      const q = db.user
        .where((q) => q.where({ Name: 'Alice' }).get('Active'))
        .pluck('Name');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name"
          FROM "schema"."user" "User"
          WHERE CASE WHEN "User"."name" = $1 THEN "User"."active" END
        `,
        ['Alice'],
      );

      expect(await q).toEqual(['Alice']);
    });

    it('should apply conditions added to the root query to an operand of `or`', async () => {
      await db.user.insertMany([
        { ...UserData, Name: 'Alice', Active: true },
        { ...UserData, Name: 'Bob', Active: true },
        { ...UserData, Name: 'Carl', Active: false },
      ]);

      const q = db.user
        .where((q) =>
          q.or(
            q.where({ Name: 'Alice' }).exists(),
            q.ref('Active').equals(false),
          ),
        )
        .pluck('Name')
        .order('Name');

      expectSql(
        q.toSQL(),
        `
          SELECT "User"."name" "Name"
          FROM "schema"."user" "User"
          WHERE ((
            CASE WHEN "User"."name" = $1 THEN true ELSE false END
            OR "User"."active" = $2
          ))
          ORDER BY "User"."name" ASC
        `,
        ['Alice', false],
      );

      expect(await q).toEqual(['Alice', 'Carl']);
    });

    it('should filter by `exists` and `notExists` of the current record, treating unknown conditions as not matching', async () => {
      await db.user.insertMany([
        { ...UserData, Name: 'Alice', Active: true },
        { ...UserData, Name: 'Bob', Active: null },
      ]);

      const exists = db.user
        .where((q) => q.where({ Active: true }).exists())
        .pluck('Name');

      const notExists = db.user
        .where((q) => q.where({ Active: true }).notExists())
        .pluck('Name');

      expectSql(
        notExists.toSQL(),
        `
          SELECT "User"."name" "Name"
          FROM "schema"."user" "User"
          WHERE CASE WHEN "User"."active" = $1 THEN false ELSE true END
        `,
        [true],
      );

      expect(await exists).toEqual(['Alice']);
      expect(await notExists).toEqual(['Bob']);
    });

    it('should throw for a relation of the root query with added conditions', () => {
      expect(() =>
        db.user.where((q) => q.where({ Name: 'Alice' }).profile.exists()),
      ).toThrow(
        'Cannot use a relation after adding conditions or other query parts to the root query in a callback',
      );
    });
  });

  it('should apply conditions added to the root query in `update`', async () => {
    await db.user.insertMany([
      { ...UserData, Name: 'Alice', Age: 20 },
      { ...UserData, Name: 'Bob', Age: 30 },
    ]);

    const q = db.user.all().update({
      Age: (q) => q.where({ Name: 'Alice' }).get('Age'),
    });

    expectSql(
      q.toSQL(),
      `
        UPDATE "schema"."user" "User"
        SET
          "age" = CASE WHEN "User"."name" = $1 THEN "User"."age" END,
          "updated_at" = now()
      `,
      ['Alice'],
    );

    await q;

    expect(await db.user.select('Name', 'Age').order('Name')).toEqual([
      { Name: 'Alice', Age: 20 },
      { Name: 'Bob', Age: null },
    ]);
  });

  it('should throw for conditions added to the query in `having`', () => {
    expect(() =>
      db.user.having((q) => q.where({ Name: 'Alice' }).count().gt(1)),
    ).toThrow(
      'Cannot use `having` after adding conditions or other query parts to the root query in a callback',
    );

    expect(() =>
      db.user.having((q) =>
        q.where({ Name: 'Alice' }).column('Active').equals(true),
      ),
    ).toThrow(
      'Cannot use `having` after adding conditions or other query parts to the root query in a callback',
    );

    expect(() =>
      ScopedUser.having((q) => q.scope('active').count().gt(1)),
    ).toThrow(
      'Cannot use `having` after adding conditions or other query parts to the root query in a callback',
    );

    expect(() =>
      db.user
        .select('Active', 'Name')
        .group('Active', 'Name')
        .having((q) =>
          q
            .count()
            .gt(1)
            .and(q.where({ Name: 'Alice' }).get('Age').gt(18)),
        )
        .toSQL(),
    ).toThrow(
      'Cannot use `having` after adding conditions or other query parts to the root query in a callback',
    );

    expect(() =>
      db.user
        .having((q) =>
          q.get((q) => q.where({ Name: 'Alice' }).get('Active').equals(true)),
        )
        .toSQL(),
    ).toThrow(
      'Cannot use `having` after adding conditions or other query parts to the root query in a callback',
    );

    expect(() =>
      db.user
        .having((q) => q.or(q.where({ Name: 'Alice' }).count().gt(1)))
        .toSQL(),
    ).toThrow(
      'Cannot use `having` after adding conditions or other query parts to the root query in a callback',
    );

    expectSql(
      db.user
        .having(
          (q) => q.count().gt(1),
          (q) => q.or(q.count().gt(2), q.count().lt(1)),
        )
        .toSQL(),
      `
        SELECT ${UserSelectAll}
        FROM "schema"."user" "User"
        HAVING count(*) > $1 AND (count(*) > $2 OR count(*) < $3)
      `,
      [1, 2, 1],
    );
  });
});
