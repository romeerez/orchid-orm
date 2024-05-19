import {
  Message,
  Profile,
  Snake,
  snakeSelectAll,
  User,
} from '../../test-utils/test-utils';
import { testWhere, testWhereExists } from './testWhere';
import { expectSql, testDb } from 'test-utils';
import { RelationQueryBase } from '../../relations';
import { Query } from '../../query/query';

describe('where', () => {
  it('should ignore undefined values', () => {
    const q = User.where({ name: undefined });
    expectSql(q.toSQL(), `SELECT * FROM "user"`);
  });

  it('should allow expression for a column', () => {
    const q = User.where({
      name: (q) => q.ref('password'),
    });

    expectSql(
      q.toSQL(),
      `
        SELECT * FROM "user"
        WHERE "user"."name" = "user"."password"
      `,
    );
  });

  it('should allow filtering by a sub query', () => {
    const q = User.where({ id: User.get('id') });

    expectSql(
      q.toSQL(),
      `
        SELECT *
        FROM "user"
        WHERE "user"."id" = (SELECT "user"."id" FROM "user" LIMIT 1)
      `,
    );
  });

  testWhere((cb) => cb(User.all()).toSQL(), `SELECT * FROM "user" WHERE`, {
    model: User,
    pkey: 'id',
    nullable: 'picture',
    text: 'name',
  });

  testWhereExists({
    joinTo: User,
    pkey: 'id',
    joinTarget: Message,
    fkey: 'authorId',
    text: 'text',
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
    pkey: 'id',
    joinTarget: Snake,
    fkey: 'tailLength',
    text: 'snakeName',
  });
});

describe('where joined columns', () => {
  testWhere(
    (cb) => cb(User.join(Message, (q) => q.on('authorId', 'id'))).toSQL(),
    `SELECT "user".* FROM "user" JOIN "message" ON "message"."authorId" = "user"."id" WHERE `,
    {
      model: User,
      columnsOf: Message,
      pkey: 'message.id',
      nullable: 'message.text',
      text: 'message.text',
    },
  );

  testWhereExists({
    joinTo: User.join(Message, (q) => q.on('authorId', 'id')),
    pkey: 'id',
    joinTarget: Profile,
    columnsOf: Message,
    fkey: 'message.authorId',
    text: 'message.text',
    selectFrom: `SELECT "user".* FROM "user" JOIN "message" ON "message"."authorId" = "user"."id"`,
  });
});

describe('where joined named columns', () => {
  testWhere(
    (cb) => cb(User.join(Snake, (q) => q.on('tailLength', 'user.id'))).toSQL(),
    `SELECT "user".* FROM "user" JOIN "snake" ON "snake"."tail_length" = "user"."id" WHERE `,
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
    pkey: 'id',
    joinTarget: Profile,
    columnsOf: Snake,
    fkey: 'snake.tailLength',
    text: 'snake.snakeName',
    selectFrom: `SELECT "user".* FROM "user" JOIN "snake" ON "snake"."tail_length" = "user"."id"`,
  });
});

describe('where sub query', () => {
  it('should handle boolean operator on aggregate sub query', () => {
    const messageRelation = Object.assign(Object.create(Message), {
      relationConfig: {
        joinQuery(q: Query, _baseQuery: Query) {
          return q;
        },
      },
    });
    messageRelation.baseQuery = messageRelation;

    const User = testDb('user', (t) => ({
      id: t.identity().primaryKey(),
    }));

    const UserWithRelation = Object.assign(User, {
      relations: {
        messages: messageRelation,
      },
      messages: messageRelation,
    }) as unknown as typeof User & {
      relations: { messages: RelationQueryBase };
      messages: RelationQueryBase;
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
});
