import { raw } from '../common';
import { QueryData, SelectQueryData } from '../sql';
import {
  expectQueryNotMutated,
  adapter,
  User,
  Profile,
  AssertEqual,
  useTestDatabase,
  db,
  insert,
  expectSql,
} from '../test-utils';
import { NumberColumn } from '../columnSchema';

describe('queryMethods', () => {
  useTestDatabase();

  describe('.clone', () => {
    it('should return new object with the same data structures', async () => {
      const cloned = User.clone();
      expect(cloned).not.toBe(User);
      expect(cloned.adapter).toBe(adapter);
      expect(cloned.table).toBe(User.table);
      expect(cloned.shape).toBe(User.shape);

      const eq: AssertEqual<
        typeof User & { query: QueryData<typeof User> },
        typeof cloned
      > = true;
      expect(eq).toBe(true);
    });
  });

  describe('toQuery', () => {
    it('should return the same object if query is present', () => {
      const a = User.clone();
      a.query = {};
      const b = a.toQuery();
      expect(a).toBe(b);

      const eq: AssertEqual<typeof a, typeof b> = true;
      expect(eq).toBe(true);
    });

    it('should return new object if it is a model', () => {
      const q = User.toQuery();
      expect(q).not.toBe(User);

      const eq: AssertEqual<
        typeof q,
        typeof User & { query: QueryData<typeof User> }
      > = true;
      expect(eq).toBe(true);
    });
  });

  describe('toSql', () => {
    it('generates sql', () => {
      const sql = User.toSql();
      expectSql(sql, `SELECT "user".* FROM "user"`);

      const eq: AssertEqual<typeof sql, { text: string; values: unknown[] }> =
        true;
      expect(eq).toBe(true);
    });
  });

  describe('.all', () => {
    it('should return the same query if already all', () => {
      const q = User.all();
      expect(q.all()).toBe(q);
    });

    it('should remove `take` from query if it is set', () => {
      const q = User.take();
      expect((q.query as SelectQueryData)?.take).toBe(true);
      expect((q.all().query as SelectQueryData)?.take).toBe(undefined);
    });

    it('should produce correct sql', () => {
      expectSql(User.all().toSql(), `SELECT "user".* FROM "user"`);
    });
  });

  describe('take', () => {
    it('limits to one and returns only one', async () => {
      const now = new Date();
      await insert('user', {
        id: 1,
        name: 'name',
        password: 'password',
        picture: null,
        createdAt: now,
        updatedAt: now,
      });

      const q = User.all();
      expectSql(q.take().toSql(), `SELECT "user".* FROM "user" LIMIT $1`, [1]);
      expectQueryNotMutated(q);

      const expected = await adapter
        .query({ text: 'SELECT * FROM "user" LIMIT 1' })
        .then((res) => res.rows[0]);

      expect(await q.take()).toEqual({
        ...expected,
        createdAt: new Date(expected.createdAt),
        updatedAt: new Date(expected.updatedAt),
      });
    });
  });

  describe('rows', () => {
    it('returns array of rows', async () => {
      const { rows: expected } = await adapter.arrays({
        text: 'SELECT * FROM "user"',
      });
      const received = await User.rows();
      expect(received).toEqual(expected);
    });

    it('removes `take` from query data', () => {
      expect((User.take().rows().query as SelectQueryData)?.take).toBe(
        undefined,
      );
    });
  });

  describe('pluck', () => {
    const now = new Date();

    beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        await insert('user', {
          id: i + 1,
          name: 'name',
          password: 'password',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    it('should return array of column values, properly parsed', async () => {
      const result = await User.pluck('createdAt');
      expect(result).toEqual([now, now, now]);

      const eq: AssertEqual<typeof result, Date[]> = true;
      expect(eq).toBe(true);
    });

    it('should support raw expression', async () => {
      const result = await User.pluck(raw<NumberColumn>('123'));
      expect(result).toEqual([123, 123, 123]);

      const eq: AssertEqual<typeof result, number[]> = true;
      expect(eq).toBe(true);
    });
  });

  describe('value', () => {
    it('returns a first value', async () => {
      const received = await User.from(
        raw(`(VALUES ('one')) "user"(one)`),
      ).value();
      expect(received).toBe('one');
    });

    it('removes `take` from query data', () => {
      expect((User.take().value().query as SelectQueryData)?.take).toBe(
        undefined,
      );
    });
  });

  describe('exec', () => {
    it('returns nothing', async () => {
      const received = await User.exec();
      expect(received).toEqual(undefined);
    });

    it('removes `take` from query data', () => {
      expect((User.take().exec().query as SelectQueryData)?.take).toBe(
        undefined,
      );
    });
  });

  describe('distinct', () => {
    it('should add distinct without specifying columns', () => {
      const q = User.all();
      expectSql(q.distinct().toSql(), 'SELECT DISTINCT "user".* FROM "user"');
      expectQueryNotMutated(q);
    });

    it('should add distinct on columns', () => {
      const q = User.all();
      expectSql(
        q.distinct('id', 'name').toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "user"."name") "user".*
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should add distinct on table.column', () => {
      const q = User.all();
      expectSql(
        q.distinct('user.id', 'user.name').toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "user"."name") "user".*
          FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should add distinct on joined columns', () => {
      const q = User.all();
      expectSql(
        q
          .join(Profile, 'profile.userId', '=', 'user.id')
          .distinct('user.id', 'profile.userId')
          .toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "profile"."userId") "user".*
          FROM "user"
          JOIN "profile" ON "profile"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should add distinct on joined columns with alias', () => {
      const q = User.all();
      expectSql(
        q
          .join(Profile.as('p'), 'p.userId', '=', 'user.id')
          .distinct('user.id', 'p.userId')
          .toSql(),
        `
          SELECT DISTINCT ON ("user"."id", "p"."userId") "user".*
          FROM "user"
          JOIN "profile" AS "p" ON "p"."userId" = "user"."id"
        `,
      );
      expectQueryNotMutated(q);
    });

    it('should add distinct on raw sql', () => {
      const q = User.all();
      expectSql(
        q.distinct(raw('"user".id')).toSql(),
        `
          SELECT DISTINCT ON ("user".id) "user".* FROM "user"
        `,
      );
      expectQueryNotMutated(q);
    });
  });

  describe('find', () => {
    it('searches one by primary key', () => {
      const q = User.all();
      expectSql(
        q.find(1).toSql(),
        `
            SELECT "user".* FROM "user"
            WHERE "user"."id" = $1
            LIMIT $2
        `,
        [1, 1],
      );
      expectQueryNotMutated(q);
    });

    it('should accept raw sql', () => {
      const q = User.all();
      expectSql(
        q.find(raw('$1 + $2', 1, 2)).toSql(),
        `
          SELECT "user".* FROM "user"
          WHERE "user"."id" = $1 + $2
          LIMIT $3
        `,
        [1, 2, 1],
      );
      expectQueryNotMutated(q);
    });
  });

  describe('as', () => {
    it('sets table alias', () => {
      const q = User.all();
      expectSql(
        q.select('id').as('as').toSql(),
        'SELECT "as"."id" FROM "user" AS "as"',
      );
      expectQueryNotMutated(q);
    });
  });

  describe('withSchema', () => {
    it('prefixes table with schema', () => {
      const Country = db(
        'country',
        (t) => ({
          id: t.serial().primaryKey(),
          name: t.text(),
        }),
        {
          schema: 'geo',
        },
      );

      const City = db('city', (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        countryId: t.integer(),
      }));

      const q = City.all();

      expectSql(
        q
          .join(Country, 'country.id', '=', 'city.countryId')
          .select('name')
          .selectAs({ countryName: 'country.name' })
          .withSchema('geo')
          .toSql(),
        `
          SELECT "city"."name", "country"."name" AS "countryName"
          FROM "geo"."city"
          JOIN "geo"."country" ON "country"."id" = "city"."countryId"
        `,
      );

      expectQueryNotMutated(q);
    });
  });

  describe('wrap', () => {
    it('should wrap query with another', () => {
      const q = User.all();
      expectSql(
        q.select('id').wrap(User.select('id')).toSql(),
        'SELECT "t"."id" FROM (SELECT "user"."id" FROM "user") AS "t"',
      );
      expectQueryNotMutated(q);
    });

    it('should accept `as` parameter', () => {
      const q = User.all();
      expectSql(
        q.select('id').wrap(User.select('id'), 'wrapped').toSql(),
        'SELECT "wrapped"."id" FROM (SELECT "user"."id" FROM "user") AS "wrapped"',
      );
      expectQueryNotMutated(q);
    });
  });

  describe('group', () => {
    it('groups by columns', () => {
      const q = User.all();
      expectSql(
        q.group('id', 'name').toSql(),
        `
        SELECT "user".* FROM "user"
        GROUP BY "user"."id", "user"."name"
      `,
      );
      expectQueryNotMutated(q);
    });

    it('groups by raw sql', () => {
      const q = User.all();
      const expectedSql = `
        SELECT "user".* FROM "user"
        GROUP BY id, name
      `;
      expectSql(q.group(raw('id'), raw('name')).toSql(), expectedSql);
      expectQueryNotMutated(q);

      q._group(raw('id'), raw('name'));
      expectSql(q.toSql(), expectedSql);
    });
  });
});

describe('window', () => {
  it('add window which can be used in `over`', () => {
    const q = User.all();

    expectSql(
      q
        .window({
          w: {
            partitionBy: 'id',
            order: {
              id: 'DESC',
            },
          },
        })
        .selectAvg('id', {
          over: 'w',
        })
        .toSql(),
      `
        SELECT avg("user"."id") OVER "w" FROM "user"
        WINDOW "w" AS (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
      `,
    );
    expectQueryNotMutated(q);
  });

  it('adds window with raw sql', () => {
    const q = User.all();

    const windowSql = 'PARTITION BY id ORDER BY name DESC';
    expectSql(
      q
        .window({ w: raw(windowSql) })
        .selectAvg('id', {
          over: 'w',
        })
        .toSql(),
      `
        SELECT avg("user"."id") OVER "w" FROM "user"
        WINDOW "w" AS (PARTITION BY id ORDER BY name DESC)
      `,
    );
    expectQueryNotMutated(q);
  });
});

describe('order', () => {
  it('adds order conditions', () => {
    const q = User.all();
    expectSql(
      q.order({ id: 'ASC', name: 'DESC' }).toSql(),
      `
        SELECT "user".* FROM "user"
        ORDER BY "user"."id" ASC, "user"."name" DESC
      `,
    );
    expectSql(
      q
        .order({
          id: { dir: 'ASC', nulls: 'FIRST' },
          name: { dir: 'DESC', nulls: 'LAST' },
        })
        .toSql(),
      `
        SELECT "user".* FROM "user"
        ORDER BY "user"."id" ASC NULLS FIRST, "user"."name" DESC NULLS LAST
      `,
    );
    expectQueryNotMutated(q);
  });

  it('adds order with raw sql', () => {
    const q = User.all();
    expectSql(
      q.order(raw('id ASC NULLS FIRST')).toSql(),
      `
        SELECT "user".* FROM "user"
        ORDER BY id ASC NULLS FIRST
      `,
    );
    expectQueryNotMutated(q);
  });
});

describe('limit', () => {
  it('sets limit', () => {
    const q = User.all();
    expectSql(q.limit(5).toSql(), 'SELECT "user".* FROM "user" LIMIT $1', [5]);
    expectQueryNotMutated(q);
  });
});

describe('offset', () => {
  it('sets offset', () => {
    const q = User.all();
    expectSql(q.offset(5).toSql(), 'SELECT "user".* FROM "user" OFFSET $1', [
      5,
    ]);
    expectQueryNotMutated(q);
  });
});

describe('exists', () => {
  it('selects 1', () => {
    const q = User.all();
    expectSql(q.exists().toSql(), 'SELECT 1 AS "exists" FROM "user"');
    expectQueryNotMutated(q);
  });
});

describe('truncate', () => {
  it('should truncate table', () => {
    const q = User.all();
    expectSql(q.truncate().toSql(), 'TRUNCATE "user"');
    expectQueryNotMutated(q);
  });

  it('should handle restart identity and cascade options', () => {
    const q = User.all();
    expectSql(
      q.truncate({ restartIdentity: true, cascade: true }).toSql(),
      'TRUNCATE "user" RESTART IDENTITY CASCADE',
    );
    expectQueryNotMutated(q);
  });
});
