import {
  Message,
  Profile,
  Snake,
  snakeSelectAll,
  User,
  userColumnsSql,
  userTableColumnsSql,
} from '../../../test-utils/pqb.test-utils';
import { testWhere, testWhereExists } from './test-where';
import { assertType, db, expectSql, sql } from 'test-utils';

describe('where', () => {
  describe('callback', () => {
    it('should use the `as` from the query', () => {
      const q = db.user
        .as('u')
        .select('Id')
        .where((q) => q.where({ Name: 'name' }));

      expectSql(
        q.toSQL(),
        `SELECT "u"."id" "Id" FROM "schema"."user" "u" WHERE ("u"."name" = $1)`,
        ['name'],
      );
    });
  });

  describe('relation', () => {
    it('should allow where-ing on a column of a selected relation', () => {
      db.user
        .select({ profile: (q) => q.profile })
        .where({ 'profile.Bio': 'bio' });
    });

    it('should allow where-ing on a column of a selected relation returning multiple', () => {
      db.user
        .select({ messages: (q) => q.messages })
        // @ts-expect-error forbidden
        .where({ 'messages.Text': 'text' });
    });

    it('should be able to operate on selected values of a relation', () => {
      db.user
        .select({
          count: (q) => q.messages.count(),
        })
        .where({
          count: 1,
        });
    });

    it('should filter based a nested relation that has `aliasValue` true', () => {
      const q = db.profile.select({
        user: (q) => q.user.select().where((q) => q.messages.count().gt(5)),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT row_to_json("user".*) "user"
          FROM "schema"."profile" "Profile"
          LEFT JOIN LATERAL (
            SELECT FROM "schema"."user"
            WHERE (
              SELECT count(*) > $1 "messages"
              FROM "schema"."message" "messages"
              WHERE ("messages"."author_id" = "user"."id" AND "messages"."message_key" = "user"."user_key")
                AND ("messages"."deleted_at" IS NULL)
            )
            AND "user"."id" = "Profile"."user_id"
            AND "user"."user_key" = "Profile"."profile_key"
          ) "user" ON true
        `,
        [5],
      );
    });
  });

  it('should not be able to operate on selected expressions', () => {
    User.select({ selected: sql<number>`sql` }).where({
      // @ts-expect-error forbidden
      selected: 1,
    });
  });

  it('should not be able to operate on selected records', () => {
    User.select({ selected: () => User }).where({
      // @ts-expect-error forbidden
      'selected.id': 1,
    });
  });

  it('should ignore undefined values', () => {
    const q = User.where({ name: undefined });
    expectSql(
      q.toSQL(),
      `SELECT ${userColumnsSql} FROM "schema"."user" "User"`,
    );
  });

  it('should allow expression for a column', () => {
    const q = User.where({
      name: (q) => q.ref('password'),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE "User"."name" = "User"."password"
      `,
    );
  });

  it('should allow filtering by a sub query', () => {
    const q = User.where({ id: () => User.get('id') });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql}
        FROM "schema"."user" "User"
        WHERE "User"."id" = (SELECT "User"."id" FROM "schema"."user" "User" LIMIT 1)
      `,
    );
  });

  testWhere(
    (cb) => cb(User.all()).toSQL(),
    `SELECT ${userColumnsSql} FROM "schema"."user" "User" WHERE`,
    {
      model: User,
      pkey: 'id',
      nullable: 'picture',
      text: 'name',
    },
  );

  testWhereExists({
    joinTo: User,
    pkey: 'User.id',
    joinTarget: Message,
    fkey: 'authorId',
    text: 'text',
  });
});

describe('whereOneOf', () => {
  it('should be appended with AND and join conditions with OR', () => {
    const q = User.where({ id: 1 }).whereOneOf({ name: 'a' }, { name: 'b' });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE "User"."id" = $1 AND ("User"."name" = $2 OR "User"."name" = $3)
      `,
      [1, 'a', 'b'],
    );
  });

  it('should ignore empty objects', () => {
    const q = User.whereOneOf({}, {});

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
      `,
    );
  });

  it('should accept empty and non-empty objects', () => {
    const q = User.whereOneOf({ id: 1 }, {});

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE ("User"."id" = $1)
      `,
      [1],
    );
  });

  it('should allow update after whereOneOf', () => {
    User.whereOneOf({ id: 1 }).update({
      name: 'name',
    });
  });

  it('should allow delete after whereOneOf', () => {
    User.whereOneOf({ id: 1 }).delete();
  });
});

describe('whereNotOneOf', () => {
  it('should be appended with AND and join conditions with OR', () => {
    const q = User.where({ id: 1 }).whereNotOneOf({ name: 'a' }, { name: 'b' });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE "User"."id" = $1 AND NOT ("User"."name" = $2 OR "User"."name" = $3)
      `,
      [1, 'a', 'b'],
    );
  });
});

describe('where with named columns', () => {
  testWhere(
    (cb) => cb(Snake.all()).toSQL(),
    `SELECT ${snakeSelectAll} FROM "schema"."snake" "Snake" WHERE`,
    {
      model: Snake,
      pkey: 'tailLength',
      nullable: 'snakeData',
      text: 'snakeName',
    },
  );

  testWhereExists({
    joinTo: User,
    pkey: 'User.id',
    joinTarget: Snake,
    fkey: 'tailLength',
    text: 'snakeName',
  });
});

describe('where joined columns', () => {
  testWhere(
    (cb) => cb(User.join(Message, (q) => q.on('authorId', 'User.id'))).toSQL(),
    `SELECT ${userTableColumnsSql} FROM "schema"."user" "User" JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id" WHERE `,
    {
      model: User,
      columnsOf: Message,
      pkey: 'Message.id',
      nullable: 'Message.text',
      text: 'Message.text',
    },
  );

  testWhereExists({
    joinTo: User.join(Message, (q) => q.on('authorId', 'User.id')),
    pkey: 'User.id',
    joinTarget: Profile,
    columnsOf: Message,
    fkey: 'Message.authorId',
    text: 'Message.text',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "schema"."user" "User" JOIN "schema"."message" "Message" ON "Message"."author_id" = "User"."id"`,
  });
});

describe('where joined named columns', () => {
  testWhere(
    (cb) => cb(User.join(Snake, (q) => q.on('tailLength', 'User.id'))).toSQL(),
    `SELECT ${userTableColumnsSql} FROM "schema"."user" "User" JOIN "schema"."snake" "Snake" ON "Snake"."tail_length" = "User"."id" WHERE `,
    {
      model: User,
      columnsOf: Snake,
      pkey: 'Snake.tailLength',
      nullable: 'Snake.snakeData',
      text: 'Snake.snakeName',
    },
  );

  testWhereExists({
    joinTo: User.join(Snake, (q) => q.on('tailLength', 'User.id')),
    pkey: 'User.id',
    joinTarget: Profile,
    columnsOf: Snake,
    fkey: 'Snake.tailLength',
    text: 'Snake.snakeName',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "schema"."user" "User" JOIN "schema"."snake" "Snake" ON "Snake"."tail_length" = "User"."id"`,
  });
});

describe('where sub query', () => {
  it('should handle boolean operator on aggregate sub query', () => {
    const q = db.user
      .select('Id')
      .where((q) =>
        q.messages.whereIn('Text', ['a', 'b', 'c']).count().equals(10),
      );

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id"
        FROM "schema"."user" "User" WHERE (
          SELECT count(*) = $1
          FROM "schema"."message" "messages"
          WHERE (
            "messages"."text" IN ($2, $3, $4)
            AND "messages"."author_id" = "User"."id"
            AND "messages"."message_key" = "User"."user_key"
          ) AND ("messages"."deleted_at" IS NULL)
        )
      `,
      [10, 'a', 'b', 'c'],
    );
  });

  it('should handle sub-query when using `get`', () => {
    // previously the where callback was resolved in SQL composing phase, and the `q` had an expression metadata,
    // which was turning the sub-where into a sub-query
    const q = User.where((q) => q.where({ id: 1 })).get('id');

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" FROM "schema"."user" "User"
        WHERE ("User"."id" = $1)
        LIMIT 1
      `,
      [1],
    );
  });
});

describe('whereIn', () => {
  describe('empty whereIn', () => {
    it('should resolve to none for a single column', async () => {
      const res = await User.whereIn('id', []);

      expect(res).toEqual([]);
    });

    it('should resolve to none for multiple columns', async () => {
      const res = await User.whereIn(['id', 'name'], []);

      expect(res).toEqual([]);
    });

    it('should resolve to none for object argument', async () => {
      const res = await User.whereIn({
        id: [],
        name: [],
      });

      expect(res).toEqual([]);
    });
  });
});

describe.each`
  method            | whereKey     | sql
  ${'whereIn'}      | ${'in'}      | ${`SELECT FROM "schema"."user" "User" WHERE (1=1) AND "User"."id" IN ($1)`}
  ${'orWhereIn'}    | ${undefined} | ${`SELECT FROM "schema"."user" "User" WHERE (1=1) OR "User"."id" IN ($1)`}
  ${'whereNotIn'}   | ${'notIn'}   | ${`SELECT FROM "schema"."user" "User" WHERE (1=1) AND NOT "User"."id" IN ($1)`}
  ${'orWhereNotIn'} | ${undefined} | ${`SELECT FROM "schema"."user" "User" WHERE (1=1) OR NOT "User"."id" IN ($1)`}
`(
  '%method',
  ({
    method,
    whereKey,
    sql,
  }: {
    method: 'whereIn' | 'orWhereIn' | 'whereNotIn' | 'orWhereNotIn';
    whereKey?: 'in' | 'notIn';
    sql: string;
  }) => {
    it('should support Set for a column param', () => {
      const q = User.whereSql`1=1`[method]('id', new Set([1])).select();

      expectSql(q.toSQL(), sql, [1]);
    });

    if (whereKey) {
      it('should support Set for a column param', () => {
        const q = User.whereSql`1=1`
          .where({ id: { [whereKey]: new Set([1]) } })
          .select();

        expectSql(q.toSQL(), sql, [1]);
      });
    }
  },
);

describe('orWhere', () => {
  it('should accept multiple args and it is equivalent to multiple calls', () => {
    const q = User.where({
      name: 'name',
      age: 10,
    }).orWhere({ id: 1, age: 20 }, { id: 2, age: 30 });

    const q2 = User.where({
      name: 'name',
      age: 10,
    })
      .orWhere({ id: 1, age: 20 })
      .orWhere({ id: 2, age: 30 });

    const sql = q.toSQL();
    expect(sql).toEqual(q2.toSQL());

    expectSql(
      sql,
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE "User"."name" = $1 AND "User"."age" = $2
           OR "User"."id" = $3 AND "User"."age" = $4
           OR "User"."id" = $5 AND "User"."age" = $6
      `,
      ['name', 10, 1, 20, 2, 30],
    );
  });

  it('should wrap sub-wheres with parens', () => {
    const q = User.where((q) => q.orWhere({ age: 20 }, { age: 30 }), {
      name: 'name',
      age: 10,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE ("User"."age" = $1 OR "User"."age" = $2)
          AND "User"."name" = $3 AND "User"."age" = $4
      `,
      [20, 30, 'name', 10],
    );
  });

  it('should wrap `OR` keyword conditions with parens', () => {
    const q = User.where({
      OR: [{ id: 1 }, { id: 2 }],
      age: 10,
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE ("User"."id" = $1 OR "User"."id" = $2) AND "User"."age" = $3
      `,
      [1, 2, 10],
    );
  });
});

describe('whereExists', () => {
  it('should forbid selecting values on a type level', () => {
    const q = User.whereExists(Snake, (q) => q.sum('tailLength'));
    assertType<typeof q, { error: 'Cannot select in whereExists' }>();

    const q2 = User.whereExists(() => Snake.sum('tailLength'));
    assertType<typeof q2, { error: 'Cannot select in whereExists' }>();
  });

  it('should handle sub-querying by a snake cased table', () => {
    const q = User.whereExists(Snake, (q) => q.on('User.id', 'tailLength'));
    const q2 = User.whereExists(Snake, (q) =>
      q.on('User.id', 'Snake.tailLength'),
    );
    const q3 = User.whereExists(Snake, (q) =>
      q.on('User.id', '=', 'Snake.tailLength'),
    );

    const sql = q.toSQL();

    expectSql(
      sql,
      `
        SELECT ${userColumnsSql} FROM "schema"."user" "User"
        WHERE EXISTS (
          SELECT 1 FROM "schema"."snake" "Snake" WHERE "User"."id" = "Snake"."tail_length"
        )
      `,
    );

    expect(q2.toSQL()).toEqual(sql);
    expect(q3.toSQL()).toEqual(sql);
  });
});
