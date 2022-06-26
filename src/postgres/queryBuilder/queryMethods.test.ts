import { expectQueryNotMutated, line, testDb } from '../test-utils';
import { HavingArg } from './toSql';
import { raw } from './common';

const { adapter, model } = testDb

describe('queryMethods', () => {
  afterAll(() => testDb.destroy())

  describe('.clone', () => {
    it('should return new object with the same data structures', () => {
      const cloned = model.clone()
      expect(cloned).not.toBe(model)
      expect(cloned.adapter).toBe(adapter)
      expect(cloned.table).toBe(model.table)
      expect(cloned.schema).toBe(model.schema)
    })
  })

  describe('toQuery', () => {
    it('should return the same object if query is present', () => {
      const q = model.clone()
      q.query = {}
      expect(q.toQuery()).toBe(q)
    })

    it('should return new object if it is a model', () => {
      expect(model.toQuery()).not.toBe(model)
    })
  })

  describe('toSql', () => {
    it('generates sql', () => {
      expect(model.toSql()).toBe(`SELECT "sample".* FROM "sample"`)
    })
  })

  describe('.all', () => {
    it('should return the same query if already all', () => {
      const q = model.all()
      expect(q.all()).toBe(q)
    })

    it('should remove `take` from query if it is set', () => {
      const q = model.take()
      expect(q.query?.take).toBe(true)
      expect(q.all().query?.take).toBe(undefined)
    })

    it('should produce correct sql', () => {
      expect(model.all().toSql()).toBe(`SELECT "sample".* FROM "sample"`)
    })
  })

  describe('take', () => {
    it('limits to one and returns only one', async () => {
      const q = model.all()
      expect(q.take().toSql()).toContain('LIMIT 1')
      expect(q.toSql()).not.toContain('LIMIT 1')
      const expected = await adapter.query('SELECT * FROM sample LIMIT 1').then(res => res.rows[0])
      expect(await q.take()).toEqual(expected)
    })
  })

  describe('rows', () => {
    it('returns array of rows', async () => {
      const { rows: expected } = await adapter.arrays('SELECT * FROM sample')
      const received = await model.rows()
      expect(received).toEqual(expected)
    })

    it('removes `take` from query data', () => {
      expect(model.take().rows().query?.take).toBe(undefined)
    })
  })

  describe('value', () => {
    it('returns a first value', async () => {
      const { rows: [[expected]] } = await adapter.arrays('SELECT * FROM sample LIMIT 1')
      const received = await model.value()
      expect(received).toEqual(expected)
    })

    it('removes `take` from query data', () => {
      expect(model.take().value().query?.take).toBe(undefined)
    })
  })

  describe('exec', () => {
    it('returns nothing', async () => {
      const received = await model.exec()
      expect(received).toEqual(undefined)
    })

    it('removes `take` from query data', () => {
      expect(model.take().exec().query?.take).toBe(undefined)
    })
  })

  describe('select', () => {
    it('selects columns', () => {
      const q = model.all()
      expect(q.select('id', 'name').toSql()).toBe(line(`
        SELECT "sample"."id", "sample"."name" FROM "sample"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('selectAs', () => {
    it('selects columns with aliases', async () => {
      const q = model.all()
      expect(q.selectAs({ aliasedId: 'id', aliasedName: 'name' }).toSql()).toBe(line(`
        SELECT "sample"."id" AS "aliasedId", "sample"."name" AS "aliasedName"
        FROM "sample"
      `))
      expectQueryNotMutated(q)
    })

    it('can select raw', () => {
      const q = model.all()
      expect(q.selectAs({ one: raw('1') }).toSql()).toBe(line(`
        SELECT 1 AS "one" FROM "sample"
      `))
      expectQueryNotMutated(q)
    })

    it('can select subquery', () => {
      const q = model.all()
      expect(q.selectAs({ subquery: model.all() }).toSql()).toBe(line(`
        SELECT
          (
            SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
            FROM (SELECT "sample".* FROM "sample") AS "t"
          ) AS "subquery"
        FROM "sample"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('distinct', () => {
    it('add distinct without specifying columns', () => {
      const q = model.all()
      expect(q.distinct().toSql()).toBe(
        'SELECT DISTINCT "sample".* FROM "sample"'
      )
      expectQueryNotMutated(q)
    })

    it('add distinct on columns', () => {
      const q = model.all()
      expect(q.distinct('id', 'name').toSql()).toBe(line(`
        SELECT DISTINCT ON ("sample"."id", "sample"."name") "sample".*
        FROM "sample"
      `))
      expectQueryNotMutated(q)
    })

    it('add distinct on raw sql', () => {
      const q = model.all()
      expect(q.distinct(raw('raw')).toSql()).toBe(line(`
        SELECT DISTINCT ON (raw) "sample".* FROM "sample"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('and', () => {
    let [where, _where] = [model.where, model._where]
    beforeEach(() => {
      model.where = jest.fn()
      model._where = jest.fn()
    })
    afterAll(() => {
      model.where = where
      model._where = _where
    })

    it('is alias for where', () => {
      model.and({})
      expect(model.where).toBeCalled()
    })

    it('has modifier', () => {
      model._and({})
      expect(model._where).toBeCalled()
    })
  })

  describe('where', () => {
    it('specifies where conditions', () => {
      const q = model.all()
      expect(q.where({ description: null }).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample" WHERE "sample"."description" IS NULL
      `))
      expect(q.where({ id: 1 }).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample" WHERE "sample"."id" = 1
      `))
      // TODO: condition for related table
      // expect(q.where({ a: { b: 1 }}).toSql()).toBe(line(`
      //   SELECT "sample".* FROM "sample" WHERE "a"."b" = 1
      // `))
      expect(q.where({ id: 1 }, q.where({ id: 2 }).or({ id: 3, name: 'n' })).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample"
        WHERE "sample"."id" = 1 AND (
          "sample"."id" = 2 OR "sample"."id" = 3 AND "sample"."name" = 'n'
        )
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw sql', () => {
      const q = model.all()
      expect(q.where({ id: raw('SQL') }).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample" WHERE "sample"."id" = SQL
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('or', () => {
    it('joins conditions with or', () => {
      const q = model.all()
      expect(q.or({ id: 1 }, { name: 'ko' }).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample"
        WHERE "sample"."id" = 1 OR "sample"."name" = 'ko'
      `))
      expect(q.or({ id: 1 }, model.where({ id: 2 }).and({ name: 'n' })).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample"
        WHERE "sample"."id" = 1 OR ("sample"."id" = 2 AND "sample"."name" = 'n')
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw sql', () => {
      const q = model.all()
      expect(q.or({ id: raw('SQL 1') }, { name: raw('SQL 2') }).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample"
        WHERE "sample"."id" = SQL 1 OR "sample"."name" = SQL 2
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('find', () => {
    it('searches one by primary key', () => {
      const q = model.all()
      expect(q.find(1).toSql()).toBe(line(`
          SELECT "sample".* FROM "sample"
          WHERE "sample"."id" = 1
          LIMIT 1
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw sql', () => {
      const q = model.all()
      expect(q.find(raw('SQL')).toSql()).toBe(line(`
        SELECT "sample".* FROM "sample"
        WHERE "sample"."id" = SQL
        LIMIT 1
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('findBy', () => {
    it('like where but with take', () => {
      const q = model.all()
      expect(q.findBy({ name: 's' }).toSql()).toBe(
        `SELECT "sample".* FROM "sample" WHERE "sample"."name" = 's' LIMIT 1`
      )
      expectQueryNotMutated(q)
    })

    it('should accept raw', () => {
      const q = model.all()
      expect(q.findBy({ name: raw('SQL') }).toSql()).toBe(
        `SELECT "sample".* FROM "sample" WHERE "sample"."name" = SQL LIMIT 1`
      )
      expectQueryNotMutated(q)
    })
  })

  describe('as', () => {
    it('sets table alias', () => {
      const q = model.all()
      expect(q.select('id').as('as').toSql()).toBe(
        'SELECT "as"."id" FROM "sample" AS "as"'
      )
      expectQueryNotMutated(q)
    })
  })

  describe('from', () => {
    it('changes from', () => {
      const q = model.all()
      expect(q.as('t').from('otherTable').toSql()).toBe(line(`
        SELECT "t".* FROM "otherTable" AS "t"
      `))
      expectQueryNotMutated(q)
    })

    it('should accept raw', () => {
      const q = model.all()
      expect(q.as('t').from(raw('otherTable')).toSql()).toBe(line(`
        SELECT "t".* FROM otherTable AS "t"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('wrap', () => {
    it('wraps query with another', () => {
      const q = model.all()
      expect(q.select('name').wrap(model.select('name')).toSql()).toBe(
        'SELECT "t"."name" FROM (SELECT "sample"."name" FROM "sample") AS "t"'
      )
      expectQueryNotMutated(q)
    })

    it('accept `as` parameter', () => {
      const q = model.all()
      expect(q.select('name').wrap(model.select('name'), 'wrapped').toSql()).toBe(
        'SELECT "wrapped"."name" FROM (SELECT "sample"."name" FROM "sample") AS "wrapped"'
      )
      expectQueryNotMutated(q)
    })
  })

  describe('json', () => {
    it('wraps a query with json functions', () => {
      const q = model.all()
      expect(q.json().toSql()).toBe(line(`
        SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS "json"
        FROM (
          SELECT "sample".* FROM "sample"
        ) AS "t"
      `))
      expectQueryNotMutated(q)
    })

    it('supports `take`', () => {
      const q = model.all()
      expect(q.take().json().toSql()).toBe(line(`
        SELECT COALESCE(row_to_json("t".*), '{}') AS "json"
        FROM (
          SELECT "sample".* FROM "sample" LIMIT 1
        ) AS "t"
      `))
      expectQueryNotMutated(q)
    })
  })

  describe('group', () => {
    it('groups by columns', () => {
      const q = model.all()
      expect(q.group('id', 'name').toSql()).toBe(line(`
        SELECT "sample".* FROM "sample"
        GROUP BY "sample"."id", "sample"."name"
      `))
      expectQueryNotMutated(q)
    })

    it('groups by raw sql', () => {
      const q = model.all()
      const expectedSql = line(`
        SELECT "sample".* FROM "sample"
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
    const q = model.all()

    const arg: HavingArg<typeof model> = {
      sum: {
        id: {
          gt: 5,
          lt: 20,
          distinct: true,
          order: 'order',
          filter: 'filter',
          withinGroup: true
        }
      },
      count: {
        id: 5
      }
    }

    const expectedSql = `
      SELECT "sample".*
      FROM "sample"
      HAVING
        sum("sample"."id")
          WITHIN GROUP (ORDER BY order)
          FILTER (WHERE filter) > 5,
        sum("sample"."id") WITHIN GROUP (ORDER BY order)
          FILTER (WHERE filter) < 20,
        count("sample"."id") = 5
    `

    expect(q.having(arg).toSql()).toBe(line(expectedSql))
    expectQueryNotMutated(q)

    q._having(arg)
    expect(q.toSql()).toBe(line(expectedSql))
  })

  it('adds having condition with raw sql', () => {
    const q = model.all()

    const expectedSql = `
      SELECT "sample".*
      FROM "sample"
      HAVING SQL 1, SQL 2
    `

    expect(q.having(raw('SQL 1'), raw('SQL 2')).toSql()).toBe(line(expectedSql))
    expectQueryNotMutated(q)

    q._having(raw('SQL 1'), raw('SQL 2'))
    expect(q.toSql()).toBe(line(expectedSql))
  })
})

// describe('window', () => {
//   it('adds WINDOW', () => {
//     const q = model.all()
//     expect(await q.window({w: 'PARTITION BY depname ORDER BY salary DESC'}).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WINDOW w AS (PARTITION BY depname ORDER BY salary DESC)
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._window({w: 'PARTITION BY depname ORDER BY salary DESC'})
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WINDOW w AS (PARTITION BY depname ORDER BY salary DESC)
//     `))
//   })
// });
//
// ['union', 'intersect', 'except'].forEach(what => {
//   const upper = what.toUpperCase()
//   describe(what, () => {
//     it(`adds ${what}`, () => {
//       const q = model.all() as any
//       let query = q.select('id')
//       query = query[what].call(query, Chat.select('id'), 'SELECT 1')
//       query = query[what + 'All'].call(query, 'SELECT 2')
//       query = query.wrap(Chat.select('id'))
//
//       expect(await query.toSql()).toBe(line(`
//         SELECT "t"."id" FROM (
//           SELECT "sample"."id" FROM "sample"
//           ${upper}
//           SELECT 1
//           ${upper}
//           SELECT "chats"."id" FROM "chats"
//           ${upper} ALL
//           SELECT 2
//         ) "t"
//       `))
//       expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//     })
//
//     it('has modifier', () => {
//       const q = model.select('id') as any
//       q[`_${what}`].call(q, 'SELECT 1')
//       expect(await q.toSql()).toBe(line(`
//         SELECT "sample"."id" FROM "sample"
//         ${upper}
//         SELECT 1
//       `))
//       q[`_${what}All`].call(q, 'SELECT 2')
//       expect(await q.toSql()).toBe(line(`
//         SELECT "sample"."id" FROM "sample"
//         ${upper}
//         SELECT 1
//         ${upper} ALL
//         SELECT 2
//       `))
//     })
//   })
// })
//
// describe('order', () => {
//   it(`defines order`, () => {
//     const q = model.all()
//     expect(
//       await q.order('id', {name: 'desc', something: 'asc nulls first'}, {a: {b: 'asc'}}).toSql()
//     ).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       ORDER BY
//         "sample"."id",
//         "sample"."name" desc,
//         "sample"."something" asc nulls first,
//         "a"."b" asc
//     `))
//     expect(await q.orderRaw('raw').toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       ORDER BY raw
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._order('id')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" ORDER BY "sample"."id"')
//   })
// })
//
// describe('limit', () => {
//   it('sets limit', () => {
//     const q = model.all()
//     expect(await q.limit(5).toSql()).toBe('SELECT "sample".* FROM "sample" LIMIT 5')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._limit(5)
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" LIMIT 5')
//   })
// })
//
// describe('offset', () => {
//   it('sets offset', () => {
//     const q = model.all()
//     expect(await q.offset(5).toSql()).toBe('SELECT "sample".* FROM "sample" OFFSET 5')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._offset(5)
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" OFFSET 5')
//   })
// })
//
// describe('for', () => {
//   it('sets for', () => {
//     const q = model.all()
//     expect(await q.for('some sql').toSql()).toBe('SELECT "sample".* FROM "sample" FOR some sql')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._for('some sql')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" FOR some sql')
//   })
// })
//
// describe('join', () => {
//   it('sets join', () => {
//     const q = model.all()
//     expect(await q.join('table', 'as', 'on').toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       JOIN "table" AS "as" ON on
//     `))
//     expect(await q.join(Message.where('a').or('b').as('as')).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       JOIN "messages" AS "as" ON a OR b
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._join('table', 'as', 'on')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       JOIN "table" AS "as" ON on
//     `))
//   })
// })
//
// describe('exists', () => {
//   it('selects 1', () => {
//     const q = model.all()
//     expect(await q.exists().toSql()).toBe('SELECT 1 FROM "sample"')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', () => {
//     const q = model.all()
//     q._exists()
//     expect(await q.toSql()).toBe('SELECT 1 FROM "sample"')
//   })
// })
//
// describe('model with hidden column', () => {
//   it('selects by default all columns except hidden', () => {
//     class ModelInterface {
//       id: number
//       name: string
//
//       @porm.hidden
//       password: string
//     }
//
//     const Model = model('table', ModelInterface)
//
//     Model.columnNames = jest.fn(() => ['id', 'name', 'password']) as any
//
//     const q = Model.all()
//     expect(await q.toSql()).toBe('SELECT "table"."id", "table"."name" FROM "table"')
//   })
// })
