import {
  Message,
  Profile,
  Snake,
  snakeSelectAll,
  User,
  userColumnsSql,
  userTableColumnsSql,
} from '../../test-utils/test-utils';
import { testWhere, testWhereExists } from './testWhere';
import { assertType, expectSql, testDb } from 'test-utils';
import { RelationConfigBase } from '../../relations';
import { Query } from '../../query/query';

describe('where', () => {
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
