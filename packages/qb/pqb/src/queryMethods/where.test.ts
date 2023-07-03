import {
  Message,
  Profile,
  Snake,
  snakeSelectAll,
  User,
} from '../test-utils/test-utils';
import { testWhere, testWhereExists } from './testWhere';
import { expectSql } from 'test-utils';

describe('and', () => {
  const [where, _where] = [User.where, User._where];
  beforeEach(() => {
    User.where = jest.fn();
    User._where = jest.fn();
  });
  afterAll(() => {
    User.where = where;
    User._where = _where;
  });

  it('is alias for where', () => {
    User.and({});
    expect(User.where).toBeCalled();
  });

  it('has modifier', () => {
    User._and({});
    expect(User._where).toBeCalled();
  });
});

describe('andNot', () => {
  const [whereNot, _whereNot] = [User.whereNot, User._whereNot];
  beforeEach(() => {
    User.whereNot = jest.fn();
    User._whereNot = jest.fn();
  });
  afterAll(() => {
    User.whereNot = whereNot;
    User._whereNot = _whereNot;
  });

  it('is alias for where', () => {
    User.andNot({});
    expect(User.whereNot).toBeCalled();
  });

  it('has modifier', () => {
    User._andNot({});
    expect(User._whereNot).toBeCalled();
  });
});

describe('where', () => {
  it('should ignore undefined values', () => {
    const q = User.where({ name: undefined });
    expectSql(q.toSql(), `SELECT * FROM "user"`);
  });

  it('should allow filtering by a sub query', () => {
    const q = User.where({ id: User.get('id') });

    expectSql(
      q.toSql(),
      `
        SELECT *
        FROM "user"
        WHERE "user"."id" = (SELECT "user"."id" FROM "user" LIMIT 1)
      `,
    );
  });

  testWhere((cb) => cb(User.all()).toSql(), `SELECT * FROM "user" WHERE`, {
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
    (cb) => cb(Snake.all()).toSql(),
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
    (cb) => cb(User.join(Message, (q) => q.on('authorId', 'id'))).toSql(),
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
    (cb) => cb(User.join(Snake, (q) => q.on('tailLength', 'user.id'))).toSql(),
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
