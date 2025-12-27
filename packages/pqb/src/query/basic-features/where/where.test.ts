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
import { assertType, db, expectSql, sql, testDb } from 'test-utils';
import { Query } from '../../query';
import { RelationConfigBase } from '../../relations';

describe('where', () => {
  describe('relation', () => {
    it('should allow where-ing on a column of a selected relation', async () => {
      db.user
        .select({ profile: (q) => q.profile })
        .where({ 'profile.Bio': 'bio' });
    });

    it('should allow where-ing on a column of a selected relation returning multiple', async () => {
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
          FROM "profile"
          LEFT JOIN LATERAL (
            SELECT FROM "user"
            WHERE (
              SELECT count(*) > $1 "messages"
              FROM "message" "messages"
              WHERE ("messages"."author_id" = "user"."id" AND "messages"."message_key" = "user"."user_key")
                AND ("messages"."deleted_at" IS NULL)
            )
            AND "user"."id" = "profile"."user_id"
            AND "user"."user_key" = "profile"."profile_key"
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
    expectSql(q.toSQL(), `SELECT ${userColumnsSql} FROM "user"`);
  });

  it('should allow expression for a column', () => {
    const q = User.where({
      name: (q) => q.ref('password'),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "user"
        WHERE "user"."name" = "user"."password"
      `,
    );
  });

  it('should allow filtering by a sub query', () => {
    const q = User.where({ id: User.get('id') });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql}
        FROM "user"
        WHERE "user"."id" = (SELECT "user"."id" FROM "user" LIMIT 1)
      `,
    );
  });

  testWhere(
    (cb) => cb(User.all()).toSQL(),
    `SELECT ${userColumnsSql} FROM "user" WHERE`,
    {
      model: User,
      pkey: 'id',
      nullable: 'picture',
      text: 'name',
    },
  );

  testWhereExists({
    joinTo: User,
    pkey: 'user.id',
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
        SELECT ${userColumnsSql} FROM "user"
        WHERE "user"."id" = $1 AND ("user"."name" = $2 OR "user"."name" = $3)
      `,
      [1, 'a', 'b'],
    );
  });

  it('should ignore empty objects', () => {
    const q = User.whereOneOf({}, {});

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "user"
      `,
    );
  });

  it('should accept empty and non-empty objects', () => {
    const q = User.whereOneOf({ id: 1 }, {});

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "user"
        WHERE ("user"."id" = $1)
      `,
      [1],
    );
  });
});

describe('whereNotOneOf', () => {
  it('should be appended with AND and join conditions with OR', () => {
    const q = User.where({ id: 1 }).whereNotOneOf({ name: 'a' }, { name: 'b' });

    expectSql(
      q.toSQL(),
      `
        SELECT ${userColumnsSql} FROM "user"
        WHERE "user"."id" = $1 AND NOT ("user"."name" = $2 OR "user"."name" = $3)
      `,
      [1, 'a', 'b'],
    );
  });
});

describe('where with named columns', () => {
  testWhere(
    (cb) => cb(Snake.all()).toSQL(),
    `SELECT ${snakeSelectAll} FROM "snake" WHERE`,
    {
      model: Snake,
      pkey: 'tailLength',
      nullable: 'snakeData',
      text: 'snakeName',
    },
  );

  testWhereExists({
    joinTo: User,
    pkey: 'user.id',
    joinTarget: Snake,
    fkey: 'tailLength',
    text: 'snakeName',
  });
});

describe('where joined columns', () => {
  testWhere(
    (cb) => cb(User.join(Message, (q) => q.on('authorId', 'user.id'))).toSQL(),
    `SELECT ${userTableColumnsSql} FROM "user" JOIN "message" ON "message"."author_id" = "user"."id" WHERE `,
    {
      model: User,
      columnsOf: Message,
      pkey: 'message.id',
      nullable: 'message.text',
      text: 'message.text',
    },
  );

  testWhereExists({
    joinTo: User.join(Message, (q) => q.on('authorId', 'user.id')),
    pkey: 'user.id',
    joinTarget: Profile,
    columnsOf: Message,
    fkey: 'message.authorId',
    text: 'message.text',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "user" JOIN "message" ON "message"."author_id" = "user"."id"`,
  });
});

describe('where joined named columns', () => {
  testWhere(
    (cb) => cb(User.join(Snake, (q) => q.on('tailLength', 'user.id'))).toSQL(),
    `SELECT ${userTableColumnsSql} FROM "user" JOIN "snake" ON "snake"."tail_length" = "user"."id" WHERE `,
    {
      model: User,
      columnsOf: Snake,
      pkey: 'snake.tailLength',
      nullable: 'snake.snakeData',
      text: 'snake.snakeName',
    },
  );

  testWhereExists({
    joinTo: User.join(Snake, (q) => q.on('tailLength', 'user.id')),
    pkey: 'user.id',
    joinTarget: Profile,
    columnsOf: Snake,
    fkey: 'snake.tailLength',
    text: 'snake.snakeName',
    selectFrom: `SELECT ${userTableColumnsSql} FROM "user" JOIN "snake" ON "snake"."tail_length" = "user"."id"`,
  });
});

describe('where sub query', () => {
  it('should handle boolean operator on aggregate sub query', () => {
    const messageRelation = {
      query: Message,
      joinQuery(q: Query, _baseQuery: Query) {
        return q;
      },
    };

    const User = testDb('user', (t) => ({
      id: t.identity().primaryKey(),
    }));

    interface Rel extends RelationConfigBase {
      query: Query;
    }

    const UserWithRelation = Object.assign(User, {
      relations: {
        messages: messageRelation,
      },
      messages: messageRelation,
    }) as unknown as typeof User & {
      relations: { messages: Rel };
      messages: Rel;
    };

    const q = UserWithRelation.where((q) =>
      q.messages.whereIn('text', ['a', 'b', 'c']).count().equals(10),
    );

    expectSql(
      q.toSQL(),
      `
        SELECT * FROM "user" WHERE (
          SELECT count(*) = $1
          FROM "message"
          WHERE "message"."text" IN ($2, $3, $4)
        )
      `,
      [10, 'a', 'b', 'c'],
    );
  });

  it('should handle sub-query when using `get`', async () => {
    // previously the where callback was resolved in SQL composing phase, and the `q` had an expression metadata,
    // which was turning the sub-where into a sub-query
    const q = User.where((q) => q.where({ id: 1 })).get('id');

    expectSql(
      q.toSQL(),
      `
        SELECT "user"."id" FROM "user"
        WHERE ("user"."id" = $1)
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
  ${'whereIn'}      | ${'in'}      | ${`SELECT FROM "user" WHERE (1=1) AND "user"."id" IN ($1)`}
  ${'orWhereIn'}    | ${undefined} | ${`SELECT FROM "user" WHERE (1=1) OR "user"."id" IN ($1)`}
  ${'whereNotIn'}   | ${'notIn'}   | ${`SELECT FROM "user" WHERE (1=1) AND NOT "user"."id" IN ($1)`}
  ${'orWhereNotIn'} | ${undefined} | ${`SELECT FROM "user" WHERE (1=1) OR NOT "user"."id" IN ($1)`}
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
        SELECT ${userColumnsSql} FROM "user"
        WHERE "user"."name" = $1 AND "user"."age" = $2
           OR "user"."id" = $3 AND "user"."age" = $4
           OR "user"."id" = $5 AND "user"."age" = $6
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
        SELECT ${userColumnsSql} FROM "user"
        WHERE ("user"."age" = $1 OR "user"."age" = $2)
          AND "user"."name" = $3 AND "user"."age" = $4
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
        SELECT ${userColumnsSql} FROM "user"
        WHERE ("user"."id" = $1 OR "user"."id" = $2) AND "user"."age" = $3
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
    const q = User.whereExists(Snake, (q) => q.on('user.id', 'tailLength'));
    const q2 = User.whereExists(Snake, (q) =>
      q.on('user.id', 'snake.tailLength'),
    );
    const q3 = User.whereExists(Snake, (q) =>
      q.on('user.id', '=', 'snake.tailLength'),
    );

    const sql = q.toSQL();

    expectSql(
      sql,
      `
        SELECT ${userColumnsSql} FROM "user"
        WHERE EXISTS (
          SELECT 1 FROM "snake" WHERE "user"."id" = "snake"."tail_length"
        )
      `,
    );

    expect(q2.toSQL()).toEqual(sql);
    expect(q3.toSQL()).toEqual(sql);
  });
});
