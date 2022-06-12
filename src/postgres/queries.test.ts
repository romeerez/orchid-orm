import { testDb } from './test-utils';

const { adapter, model } = testDb

describe('postgres queries', () => {
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
    it('generates sql', async () => {
      expect(await model.toSql()).toBe(`SELECT "sample".* FROM "sample"`)
    })
  })

  describe('.all', () => {
    it('should return the same model', () => {
      expect(model.all()).toBe(model)
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

    it('removes `take` from query data', async () => {
      expect(model.take().rows().query?.take).toBe(undefined)
    })
  })

  describe('value', () => {
    it('returns a first value', async () => {
      const { rows: [[expected]] } = await adapter.arrays('SELECT * FROM sample LIMIT 1')
      const received = await model.value()
      expect(received).toEqual(expected)
    })

    it('removes `take` from query data', async () => {
      expect(model.take().value().query?.take).toBe(undefined)
    })
  })

  describe('exec', () => {
    it('returns nothing', async () => {
      const received = await model.exec()
      expect(received).toEqual(undefined)
    })

    it('removes `take` from query data', async () => {
      expect(model.take().exec().query?.take).toBe(undefined)
    })
  })


  describe('select', () => {
    it('should return selected columns', async () => {
      const expected = await adapter.query('SELECT name FROM sample').then(res => res.rows)
      const received = await model.select('name').all()
      expect(received).toEqual(expected)
    })
  })

  describe('selectRaw', () => {
    it('should select with raw sql', async () => {
      const res = await model
        .selectRaw('1 as one')
        .asType()<{ one: number }>()
        .take()

      expect(res).toEqual({ one: 1 })
    })
  })

// describe('where', () => {
//   let [and, _and] = [User.and, User._and]
//   beforeEach(() => {
//     User.and = jest.fn()
//     User._and = jest.fn()
//   })
//   afterAll(() => {
//     User.and = and
//     User._and = _and
//   })
//
//   it('is alias to and', () => {
//     const q = User.all()
//     q.where()
//     expect(q.and).toBeCalled()
//   })
//
//   it('has modifier', () => {
//     const q = User.all()
//     q._where()
//     expect(q._and).toBeCalled()
//   })
// })
//
// describe('and', () => {
//   it('joins where conditions with and', async () => {
//     const q = User.all()
//     expect(await q.and({column: null}).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample" WHERE "sample"."column" IS NULL
//     `))
//     expect(await q.and({a: 1}).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample" WHERE "sample"."a" = 1
//     `))
//     expect(await q.and({a: {b: 1}}).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample" WHERE "a"."b" = 1
//     `))
//     expect(await q.and({a: 1}, q.where({b: 2}).or({c: 3, d: 4})).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WHERE "sample"."a" = 1 AND (
//         "sample"."b" = 2 OR "sample"."c" = 3 AND "sample"."d" = 4
//       )
//     `))
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._and('q')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample" WHERE q
//     `))
//   })
// })
//
// describe('or', () => {
//   it('joins conditions with or', async () => {
//     const q = User.all()
//     expect(await q.or('a', 'b').toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WHERE a OR b
//     `))
//     expect(await q.or({a: 1}, {a: 2}).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WHERE "sample"."a" = 1 OR "sample"."a" = 2
//     `))
//     expect(await q.or({a: 1}, q.where({b: 2}).or({c: 3})).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WHERE "sample"."a" = 1 OR ("sample"."b" = 2 OR "sample"."c" = 3)
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._or('a', 'b')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WHERE a OR b
//     `))
//   })
// })

  // describe('find', () => {
  //   it('searches one by primary key', async () => {
  //     expect(await model.find(1).toSql()).toBe(`SELECT "sample".* FROM "sample" WHERE "sample"."id" = 1 LIMIT 1`)
  //   })
  // })
})

// describe('wrap', () => {
//   it('wraps query with another', async () => {
//     const q = User.select('innerQuery')
//     expect(await q.wrap(User.select('outerQuery')).toSql()).toBe(
//       'SELECT "t"."outerQuery" FROM (SELECT "sample"."innerQuery" FROM "sample") "t"'
//     )
//   })
//
//   it('accept `as` parameter', async () => {
//     const q = User.select('innerQuery')
//     expect(await q.wrap(User.select('outerQuery'), 'wrapped').toSql()).toBe(
//       'SELECT "wrapped"."outerQuery" FROM (SELECT "sample"."innerQuery" FROM "sample") "wrapped"'
//     )
//   })
// })
//
// describe('json', () => {
//   it('wraps a query with json functions', async () => {
//     const q = User.all()
//     expect(await q.json().toSql()).toBe(line(`
//       SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS json
//       FROM (
//         SELECT "sample".* FROM "sample"
//       ) "t"
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('supports `take`', async () => {
//     expect(await User.take().json().toSql()).toBe(line(`
//       SELECT COALESCE(row_to_json("t".*), '{}') AS json
//       FROM (
//         SELECT "sample".* FROM "sample" LIMIT 1
//       ) "t"
//     `))
//   })
// })
//
// describe('as', () => {
//   it('sets table alias', async () => {
//     const q = User.all()
//     expect(await q.select('id').as('as').toSql()).toBe(
//       'SELECT "as"."id" FROM "sample" "as"'
//     )
//     expect(await q.toSql()).not.toContain('as')
//   })
// })
//
// describe('distinct and distinctRaw', () => {
//   it('add distinct', async () => {
//     const q = User.all()
//     expect(await q.distinct().toSql()).toBe(
//       'SELECT DISTINCT "sample".* FROM "sample"'
//     )
//     expect(await q.distinct('id', 'name').toSql()).toBe(line(`
//       SELECT DISTINCT ON ("sample"."id", "sample"."name") "sample".*
//       FROM "sample"
//     `))
//     expect(await q.distinctRaw('raw').toSql()).toBe(line(`
//       SELECT DISTINCT ON (raw) "sample".*
//       FROM "sample"
//     `))
//     expect(await q.distinct('one').distinctRaw('two').toSql()).toBe(line(`
//       SELECT DISTINCT ON ("sample"."one", two) "sample".*
//       FROM "sample"
//     `))
//     expect(await q.toSql()).not.toContain('DISTINCT')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._distinct()
//     expect(await q.toSql()).toContain('DISTINCT')
//     q._distinct(false)
//     expect(await q.toSql()).not.toContain('DISTINCT')
//     q._distinctRaw()
//     expect(await q.toSql()).toContain('DISTINCT')
//     q._distinctRaw(false)
//     expect(await q.toSql()).not.toContain('DISTINCT')
//   })
// })
//
// describe('select and selectRaw', () => {
//   it('selects', async () => {
//     const q = User.all()
//     expect(await q.select('id', 'name').toSql()).toBe(line(`
//       SELECT "sample"."id", "sample"."name" FROM "sample"
//     `))
//     expect(await q.select({firstName: 'name'}).toSql()).toBe(line(`
//       SELECT "sample"."name" AS "firstName" FROM "sample"
//     `))
//     expect(await q.select({subquery: User.all()}).toSql()).toBe(line(`
//       SELECT
//           (
//             SELECT COALESCE(json_agg(row_to_json("t".*)), '[]') AS json
//             FROM (SELECT "sample".* FROM "sample") "t"
//           ) AS "subquery"
//       FROM "sample"
//     `))
//     expect(await q.selectRaw('raw').toSql()).toBe(line(`
//       SELECT raw FROM "sample"
//     `))
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//     `))
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._select('id')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample"."id" FROM "sample"
//     `))
//   })
// })
//
// describe('from', () => {
//   it('changes from', async () => {
//     const q = User.all()
//     expect(await q.as('t').from('otherTable').toSql()).toBe(line(`
//       SELECT "t".* FROM otherTable "t"
//     `))
//     expect(await q.toSql()).toContain('sample')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._as('t')._from('otherTable')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "t".* FROM otherTable "t"
//     `))
//   })
// })
//
// describe('findBy', () => {
//   it('like where but with take', async () => {
//     const q = User.all()
//     expect(await q.findBy({a: 1}).toSql()).toBe(
//       'SELECT "sample".* FROM "sample" WHERE "sample"."a" = 1 LIMIT 1'
//     )
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._findBy({a: 1})
//     expect(await q.toSql()).toBe(
//       'SELECT "sample".* FROM "sample" WHERE "sample"."a" = 1 LIMIT 1'
//     )
//   })
// })
//
// describe('group', () => {
//   it('adds GROUP BY', async () => {
//     const q = User.all()
//     expect(await q.group('id', 'name').toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       GROUP BY "sample"."id", "sample"."name"
//     `))
//     expect(await q.groupRaw('id', 'name').toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       GROUP BY id, name
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._group('id')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       GROUP BY "sample"."id"
//     `))
//     q._groupRaw('name')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       GROUP BY "sample"."id", name
//     `))
//   })
// })
//
// describe('having', () => {
//   it('adds HAVING', async () => {
//     const q = User.all()
//     expect(await q.having('sum(rating) > 30', 'count(id) > 5').toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       HAVING sum(rating) > 30, count(id) > 5
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._having('sum(rating) > 30', 'count(id) > 5')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       HAVING sum(rating) > 30, count(id) > 5
//     `))
//   })
// })
//
// describe('window', () => {
//   it('adds WINDOW', async () => {
//     const q = User.all()
//     expect(await q.window({w: 'PARTITION BY depname ORDER BY salary DESC'}).toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       WINDOW w AS (PARTITION BY depname ORDER BY salary DESC)
//     `))
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
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
//     it(`adds ${what}`, async () => {
//       const q = User.all() as any
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
//     it('has modifier', async () => {
//       const q = User.select('id') as any
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
//   it(`defines order`, async () => {
//     const q = User.all()
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
//   it('has modifier', async () => {
//     const q = User.all()
//     q._order('id')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" ORDER BY "sample"."id"')
//   })
// })
//
// describe('limit', () => {
//   it('sets limit', async () => {
//     const q = User.all()
//     expect(await q.limit(5).toSql()).toBe('SELECT "sample".* FROM "sample" LIMIT 5')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._limit(5)
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" LIMIT 5')
//   })
// })
//
// describe('offset', () => {
//   it('sets offset', async () => {
//     const q = User.all()
//     expect(await q.offset(5).toSql()).toBe('SELECT "sample".* FROM "sample" OFFSET 5')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._offset(5)
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" OFFSET 5')
//   })
// })
//
// describe('for', () => {
//   it('sets for', async () => {
//     const q = User.all()
//     expect(await q.for('some sql').toSql()).toBe('SELECT "sample".* FROM "sample" FOR some sql')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._for('some sql')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample" FOR some sql')
//   })
// })
//
// describe('join', () => {
//   it('sets join', async () => {
//     const q = User.all()
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
//   it('has modifier', async () => {
//     const q = User.all()
//     q._join('table', 'as', 'on')
//     expect(await q.toSql()).toBe(line(`
//       SELECT "sample".* FROM "sample"
//       JOIN "table" AS "as" ON on
//     `))
//   })
// })
//
// describe('exists', () => {
//   it('selects 1', async () => {
//     const q = User.all()
//     expect(await q.exists().toSql()).toBe('SELECT 1 FROM "sample"')
//     expect(await q.toSql()).toBe('SELECT "sample".* FROM "sample"')
//   })
//
//   it('has modifier', async () => {
//     const q = User.all()
//     q._exists()
//     expect(await q.toSql()).toBe('SELECT 1 FROM "sample"')
//   })
// })
//
// describe('model with hidden column', () => {
//   it('selects by default all columns except hidden', async () => {
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
