import { expectQueryNotMutated, line} from '../test-utils/test-utils';
import { HavingArg } from './toSql';
import { raw } from './common';
import { createPg, testDb } from '../test-utils/test-db';
import { model } from '../model';

const { adapter, user: User, chat: Chat, message: Message } = testDb

describe('queryMethods', () => {
  afterAll(() => testDb.destroy())

  describe('.clone', () => {
    it('should return new object with the same data structures', async () => {
      const cloned = User.clone()
      expect(cloned).not.toBe(User)
      expect(cloned.adapter).toBe(adapter)
      expect(cloned.table).toBe(User.table)
      expect(cloned.schema).toBe(User.schema)
    })
  })

  describe('toQuery', () => {
    it('should return the same object if query is present', () => {
      const q = User.clone()
      q.query = {}
      expect(q.toQuery()).toBe(q)
    })

    it('should return new object if it is a User', () => {
      expect(User.toQuery()).not.toBe(User)
    })
  })

  describe('toSql', () => {
    it('generates sql', () => {
      expect(User.toSql()).toBe(`SELECT "user".* FROM "user"`)
    })
  })

  describe('.all', () => {
    it('should return the same query if already all', () => {
      const q = User.all()
      expect(q.all()).toBe(q)
    })

    it('should remove `take` from query if it is set', () => {
      const q = User.take()
      expect(q.query?.take).toBe(true)
      expect(q.all().query?.take).toBe(undefined)
    })

    it('should produce correct sql', () => {
      expect(User.all().toSql()).toBe(`SELECT "user".* FROM "user"`)
    })
  })

  describe('take', () => {
    it('limits to one and returns only one', async () => {
      const q = User.all()
      expect(q.take().toSql()).toContain('LIMIT 1')
      expect(q.toSql()).not.toContain('LIMIT 1')
      const expected = await adapter.query('SELECT * FROM "user" LIMIT 1').then(res => res.rows[0])
      expect(await q.take()).toEqual(expected)
    })
  })

  describe('rows', () => {
    it('returns array of rows', async () => {
      const { rows: expected } = await adapter.arrays('SELECT * FROM "user"')
      const received = await User.rows()
      expect(received).toEqual(expected)
    })

    it('removes `take` from query data', () => {
      expect(User.take().rows().query?.take).toBe(undefined)
    })
  })

  describe('value', () => {
    it('returns a first value', async () => {
      const received = await User.from(raw(`(VALUES ('one')) "user"(a)`)).value()
      expect(received).toBe('one')
    })

    it('removes `take` from query data', () => {
      expect(User.take().value().query?.take).toBe(undefined)
    })
  })

  describe('exec', () => {
    it('returns nothing', async () => {
      const received = await User.exec()
      expect(received).toEqual(undefined)
    })

    it('removes `take` from query data', () => {
      expect(User.take().exec().query?.take).toBe(undefined)
    })
  })

  describe('select', () => {
    it('selects columns', () => {
      const q = User.all()
      expect(q.select('id', 'name').toSql()).toBe(line(`
        SELECT "user"."id", "user"."name" FROM "user"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('selectAs', () => {
    it('selects columns with aliases', async () => {
      const q = User.all()
      expect(q.selectAs({ aliasedId: 'id', aliasedName: 'name' }).toSql()).toBe(line(`
        SELECT "user"."id" AS "aliasedId", "user"."name" AS "aliasedName"
        FROM "user"
      `))
      expectQueryNotMutated(q)
    })

    it('can select raw', () => {
      const q = User.all()
      expect(q.selectAs({ one: raw('1') }).toSql()).toBe(line(`
        SELECT 1 AS "one" FROM "user"
      `))
      expectQueryNotMutated(q)
    })

    it('can select subquery', () => {
      const q = User.all()
      expect(q.selectAs({ subquery: User.all() }).toSql()).toBe(line(`
        SELECT
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (SELECT "user".* FROM "user") AS "t"
          ) AS "subquery"
        FROM "user"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('distinct', () => {
    it('add distinct without specifying columns', () => {
      const q = User.all()
      expect(q.distinct().toSql()).toBe(
        'SELECT DISTINCT "user".* FROM "user"'
      )
      expectQueryNotMutated(q)
    })

    it('add distinct on columns', () => {
      const q = User.all()
      expect(q.distinct('id', 'name').toSql()).toBe(line(`
        SELECT DISTINCT ON ("user"."id", "user"."name") "user".*
        FROM "user"
      `))
      expectQueryNotMutated(q)
    })

    it('add distinct on raw sql', () => {
      const q = User.all()
      expect(q.distinct(raw('"user".id')).toSql()).toBe(line(`
        SELECT DISTINCT ON ("user".id) "user".* FROM "user"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('and', () => {
    let [where, _where] = [User.where, User._where]
    beforeEach(() => {
      User.where = jest.fn()
      User._where = jest.fn()
    })
    afterAll(() => {
      User.where = where
      User._where = _where
    })

    it('is alias for where', () => {
      User.and({})
      expect(User.where).toBeCalled()
    })

    it('has modifier', () => {
      User._and({})
      expect(User._where).toBeCalled()
    })
  })

  describe('where', () => {
    it('specifies where conditions', () => {
      const q = User.all()
      expect(q.where({ picture: null }).toSql()).toBe(line(`
        SELECT "user".* FROM "user" WHERE "user"."picture" IS NULL
      `))
      expect(q.where({ id: 1 }).toSql()).toBe(line(`
        SELECT "user".* FROM "user" WHERE "user"."id" = 1
      `))
      // TODO: condition for related table
      // expect(q.where({ a: { b: 1 }}).toSql()).toBe(line(`
      //   SELECT "user".* FROM "user" WHERE "a"."b" = 1
      // `))
      expect(q.where({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' })).toSql()).toBe(line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 AND (
          "user"."id" = 2 OR "user"."id" = 3 AND "user"."name" = 'n'
        )
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw sql', () => {
      const q = User.all()
      expect(q.where({ id: raw('1 + 2') }).toSql()).toBe(line(`
        SELECT "user".* FROM "user" WHERE "user"."id" = 1 + 2
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('or', () => {
    it('joins conditions with or', () => {
      const q = User.all()
      expect(q.or({ id: 1 }, { name: 'ko' }).toSql()).toBe(line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 OR "user"."name" = 'ko'
      `))
      expect(q.or({ id: 1 }, User.where({ id: 2 }).and({ name: 'n' })).toSql()).toBe(line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 OR ("user"."id" = 2 AND "user"."name" = 'n')
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw sql', () => {
      const q = User.all()
      expect(q.or({ id: raw('1 + 2') }, { name: raw('2 + 3') }).toSql()).toBe(line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 + 2 OR "user"."name" = 2 + 3
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('find', () => {
    it('searches one by primary key', () => {
      const q = User.all()
      expect(q.find(1).toSql()).toBe(line(`
          SELECT "user".* FROM "user"
          WHERE "user"."id" = 1
          LIMIT 1
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw sql', () => {
      const q = User.all()
      expect(q.find(raw('1 + 2')).toSql()).toBe(line(`
        SELECT "user".* FROM "user"
        WHERE "user"."id" = 1 + 2
        LIMIT 1
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('findBy', () => {
    it('like where but with take', () => {
      const q = User.all()
      expect(q.findBy({ name: 's' }).toSql()).toBe(
        `SELECT "user".* FROM "user" WHERE "user"."name" = 's' LIMIT 1`
      )
      expectQueryNotMutated(q)
    })

    it('should accept raw', () => {
      const q = User.all()
      expect(q.findBy({ name: raw(`'string'`) }).toSql()).toBe(
        `SELECT "user".* FROM "user" WHERE "user"."name" = 'string' LIMIT 1`
      )
      expectQueryNotMutated(q)
    })
  })

  describe('as', () => {
    it('sets table alias', () => {
      const q = User.all()
      expect(q.select('id').as('as').toSql()).toBe(
        'SELECT "as"."id" FROM "user" AS "as"'
      )
      expectQueryNotMutated(q)
    })
  })

  describe('from', () => {
    it('changes from', () => {
      const q = User.all()
      expect(q.as('t').from('profile').toSql()).toBe(line(`
        SELECT "t".* FROM "profile" AS "t"
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw', () => {
      const q = User.all()
      expect(q.as('t').from(raw('profile')).toSql()).toBe(line(`
        SELECT "t".* FROM profile AS "t"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('wrap', () => {
    it('wraps query with another', () => {
      const q = User.all()
      expect(q.select('name').wrap(User.select('name')).toSql()).toBe(
        'SELECT "t"."name" FROM (SELECT "user"."name" FROM "user") AS "t"'
      )
      expectQueryNotMutated(q)
    })

    it('accept `as` parameter', () => {
      const q = User.all()
      expect(q.select('name').wrap(User.select('name'), 'wrapped').toSql()).toBe(
        'SELECT "wrapped"."name" FROM (SELECT "user"."name" FROM "user") AS "wrapped"'
      )
      expectQueryNotMutated(q)
    })
  })

  describe('json', () => {
    it('wraps a query with json functions', () => {
      const q = User.all()
      expect(q.json().toSql()).toBe(line(`
        SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
        FROM (
          SELECT "user".* FROM "user"
        ) AS "t"
      `))
      expectQueryNotMutated(q)
    })

    it('supports `take`', () => {
      const q = User.all()
      expect(q.take().json().toSql()).toBe(line(`
        SELECT COALESCE(row_to_json("t".*), '{}') AS "json"
        FROM (
          SELECT "user".* FROM "user" LIMIT 1
        ) AS "t"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('group', () => {
    it('groups by columns', () => {
      const q = User.all()
      expect(q.group('id', 'name').toSql()).toBe(line(`
        SELECT "user".* FROM "user"
        GROUP BY "user"."id", "user"."name"
      `))
      expectQueryNotMutated(q)
    })

    it('groups by raw sql', () => {
      const q = User.all()
      const expectedSql = line(`
        SELECT "user".* FROM "user"
        GROUP BY id, name
      `)
      expect(q.group(raw('id'), raw('name')).toSql()).toBe(expectedSql)
      expectQueryNotMutated(q)

      q._group(raw('id'), raw('name'))
      expect(q.toSql()).toBe(expectedSql)
    })
  })
})

describe('having', () => {
  it('adds having conditions from nested structure argument', () => {
    const q = User.all()

    // TODO: improve order and filter for TS
    const arg: HavingArg<typeof User> = {
      sum: {
        id: {
          gt: 5,
          lt: 20,
          distinct: true,
          order: 'name ASC',
          filter: 'id < 20',
          withinGroup: true
        }
      },
      count: {
        id: 5
      }
    }

    const expectedSql = `
      SELECT "user".*
      FROM "user"
      HAVING sum("user"."id")
          WITHIN GROUP (ORDER BY name ASC)
          FILTER (WHERE id < 20) > 5
        AND sum("user"."id")
          WITHIN GROUP (ORDER BY name ASC)
          FILTER (WHERE id < 20) < 20
        AND count("user"."id") = 5
    `

    expect(q.having(arg).toSql()).toBe(line(expectedSql))
    expectQueryNotMutated(q)

    q._having(arg)
    expect(q.toSql()).toBe(line(expectedSql))
  })

  it('adds having condition with raw sql', () => {
    const q = User.all()

    const expectedSql = `
      SELECT "user".*
      FROM "user"
      HAVING count(*) = 1 AND sum(id) = 2
    `

    expect(q.having(raw('count(*) = 1'), raw('sum(id) = 2')).toSql()).toBe(line(expectedSql))
    expectQueryNotMutated(q)

    q._having(raw('count(*) = 1'), raw('sum(id) = 2'))
    expect(q.toSql()).toBe(line(expectedSql))
  })
})

describe('window', () => {
  it('add window which can be used in `over`', () => {
    const q = User.all()

    expect(
      q.window({
        w: {
          partitionBy: 'id',
          order: {
            id: 'DESC'
          }
        }
      }).selectAvg('id', {
        over: 'w'
      }).toSql()
    ).toBe(line(`
      SELECT avg("user"."id") OVER "w" FROM "user"
      WINDOW "w" AS (PARTITION BY "user"."id" ORDER BY "user"."id" DESC)
    `))
    expectQueryNotMutated(q)
  })

  it('adds window with raw sql', () => {
    const q = User.all()

    const windowSql = 'PARTITION BY id ORDER BY name DESC'
    expect(
      q.window({ w: raw(windowSql) })
        .selectAvg('id', {
          over: 'w'
        }).toSql()
    ).toBe(line(`
      SELECT avg("user"."id") OVER "w" FROM "user"
      WINDOW "w" AS (PARTITION BY id ORDER BY name DESC)
    `))
    expectQueryNotMutated(q)
  })
});

['union', 'intersect', 'except'].forEach(what => {
  const upper = what.toUpperCase()
  describe(what, () => {
    it(`adds ${what}`, () => {
      const q = User.all() as any
      let query = q.select('id')
      query = query[what](Chat.select('id'), raw('SELECT 1'))
      query = query[what + 'All'](raw('SELECT 2'))
      query = query.wrap(User.select('id'))

      expect(query.toSql()).toBe(line(`
        SELECT "t"."id" FROM (
          SELECT "user"."id" FROM "user"
          ${upper}
          SELECT "chat"."id" FROM "chat"
          ${upper}
          SELECT 1
          ${upper} ALL
          SELECT 2
        ) AS "t"
      `))

      expectQueryNotMutated(q)
    })

    it('has modifier', () => {
      const q = User.select('id') as any
      q[`_${what}`](raw('SELECT 1'))
      expect(q.toSql()).toBe(line(`
        SELECT "user"."id" FROM "user"
        ${upper}
        SELECT 1
      `))
      q[`_${what}All`](raw('SELECT 2'))
      expect(q.toSql()).toBe(line(`
        SELECT "user"."id" FROM "user"
        ${upper}
        SELECT 1
        ${upper} ALL
        SELECT 2
      `))
    })
  })
})

describe('order', () => {
  it('adds order conditions', () => {
    const q = User.all()
    expect(
      q.order({ id: 'ASC', name: 'DESC' }).toSql()
    ).toBe(line(`
      SELECT "user".* FROM "user"
      ORDER BY "user"."id" ASC, "user"."name" DESC
    `))
    expect(
      q.order({ id: { dir: 'ASC', nulls: 'FIRST' }, name: { dir: 'DESC', nulls: 'LAST' } }).toSql()
    ).toBe(line(`
      SELECT "user".* FROM "user"
      ORDER BY "user"."id" ASC NULLS FIRST, "user"."name" DESC NULLS LAST
    `))
    expectQueryNotMutated(q)
  })

  it('adds order with raw sql', () => {
    const q = User.all()
    expect(q.order(raw('id ASC NULLS FIRST')).toSql()).toBe(line(`
      SELECT "user".* FROM "user"
      ORDER BY id ASC NULLS FIRST
    `))
    expectQueryNotMutated(q)
  })
})

describe('limit', () => {
  it('sets limit', () => {
    const q = User.all()
    expect(q.limit(5).toSql()).toBe('SELECT "user".* FROM "user" LIMIT 5')
    expectQueryNotMutated(q)
  })
})

describe('offset', () => {
  it('sets offset', () => {
    const q = User.all()
    expect(q.offset(5).toSql()).toBe('SELECT "user".* FROM "user" OFFSET 5')
    expectQueryNotMutated(q)
  })
})

describe('for', () => {
  it('sets for', () => {
    const q = User.all()
    expect(q.for(raw('UPDATE OF chat')).toSql()).toBe('SELECT "user".* FROM "user" FOR UPDATE OF chat')
    expectQueryNotMutated(q)
  })
})

describe('exists', () => {
  it('selects 1', () => {
    const q = User.all()
    expect(q.exists().toSql()).toBe('SELECT 1 AS "exists" FROM "user"')
    expectQueryNotMutated(q)
  })
})

describe('join', () => {
  it('can accept left column, op and right column', () => {
    const q = User.all()
    expect(q.join(Message, 'authorId', '=', 'id').toSql()).toBe(line(`
      SELECT "user".* FROM "user"
      JOIN "message" ON "message"."authorId" = "user"."id"
    `))
    expect(q.join(Message.as('as'), 'authorId', '=', 'id').toSql()).toBe(line(`
      SELECT "user".* FROM "user"
      JOIN "message" AS "as" ON "as"."authorId" = "user"."id"
    `))
    expectQueryNotMutated(q)
  })

  it('can accept raw sql', () => {
    const q = User.all()
    expect(q.join(Message, raw('"authorId" = "user".id')).toSql()).toBe(line(`
      SELECT "user".* FROM "user"
      JOIN "message" ON "authorId" = "user".id
    `))
    expect(q.join(Message.as('as'), raw('"authorId" = "user".id')).toSql()).toBe(line(`
      SELECT "user".* FROM "user"
      JOIN "message" AS "as" ON "authorId" = "user".id
    `))
    expectQueryNotMutated(q)
  })

  it('can accept callback to specify custom conditions', () => {
    const q = User.all()
    expect(q.join(Message, (q) => {
      return q.on('message.authorId', '=', 'user.id')
        .onOr('message.text', '=', 'user.name')
    }).toSql()).toBe(line(`
      SELECT "user".* FROM "user"
      JOIN "message"
        ON "message"."authorId" = "user"."id"
       AND "message"."text" = "user"."name"
    `))
    expectQueryNotMutated(q)
  })
})

describe('model with hidden column', () => {
  it('selects by default all columns except hidden', () => {
    class User extends model({
      table: 'user',
      schema: (t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text().hidden(),
        picture: t.text().nullable(),
        createdAt: t.timestamp(),
        updatedAt: t.timestamp(),
      })
    }) {}

    const db = createPg({
      user: User,
    });

    const q = db.user.all()
    expect(q.toSql()).toBe(line(`
      SELECT
        "user"."id",
        "user"."name",
        "user"."picture",
        "user"."createdAt",
        "user"."updatedAt"
      FROM "user"
    `))
  })
})
