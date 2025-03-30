import { orchidORM } from './orm';
import {
  BaseTable,
  chatData,
  db,
  messageData,
  userData,
  useTestORM,
} from './test-utils/orm.test-utils';
import { assertType, expectSql } from 'test-utils';
import { Selectable } from './baseTable';
import { Db, raw } from 'pqb';

describe('orm', () => {
  useTestORM();

  type User = Selectable<UserTable>;
  class UserTable extends BaseTable {
    readonly table = 'user';
    filePath = 'orm.test.ts';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));
  }

  class ProfileTable extends BaseTable {
    readonly table = 'profile';
    filePath = 'orm.test.ts';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
    }));
  }

  it('should save `tableData` to the table`s query builder `internal`', () => {
    const checkSql = raw({ raw: 'one > 5' });

    class Table extends BaseTable {
      readonly table = 'table';
      columns = this.setColumns(
        (t) => ({
          id: t.identity().primaryKey(),
          name: t.string(),
        }),
        (t) => [
          t.primaryKey(['id', 'name']),
          t.index(['id', 'name']),
          t.check(checkSql, 'constraintName'),
        ],
      );
    }

    const local = orchidORM(
      { db: db.$queryBuilder },
      {
        table: Table,
      },
    );

    expect(local.table.internal.tableData).toMatchObject({
      primaryKey: { columns: ['id', 'name'] },
      indexes: [
        { columns: [{ column: 'id' }, { column: 'name' }], options: {} },
      ],
      constraints: [{ name: 'constraintName', check: checkSql }],
    });
  });

  it('should return object with provided adapter, close and transaction method, tables', () => {
    const local = orchidORM(
      { db: db.$queryBuilder },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    expect('$adapter' in local).toBe(true);
    expect(local.$close).toBeInstanceOf(Function);
    expect(local.$transaction).toBeInstanceOf(Function);
    expect(Object.keys(local)).toEqual(
      expect.arrayContaining(['user', 'profile']),
    );
  });

  it('should return table which is a queryable interface', async () => {
    const local = orchidORM(
      { db: db.$queryBuilder },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    const { id, name } = await local.user.create({
      name: 'name',
      password: 'password',
    });

    const query = local.user.select('id', 'name').where({ id: { gt: 0 } });

    expectSql(
      query.toSQL(),
      `
        SELECT "user"."id", "user"."name"
        FROM "user"
        WHERE "user"."id" > $1
      `,
      [0],
    );

    const result = await query;
    expect(result).toEqual([{ id, name }]);

    assertType<typeof result, Pick<User, 'id' | 'name'>[]>();
  });

  it('should be able to turn on autoPreparedStatements', () => {
    const local = orchidORM(
      { db: db.$queryBuilder, autoPreparedStatements: true },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    expect(local.user.q.autoPreparedStatements).toBe(true);
  });

  describe('query methods', () => {
    it('should perform a query with the $query method', async () => {
      const spy = jest.spyOn(db.$queryBuilder as Db, 'query');

      await db.$query`SELECT 1`;

      expect(spy).toBeCalledWith`SELECT 1`;
    });

    it('should query arrays with the $queryArrays method', async () => {
      const spy = jest.spyOn(db.$queryBuilder as Db, 'queryArrays');

      await db.$queryArrays`SELECT 1`;

      expect(spy).toBeCalledWith`SELECT 1`;
    });
  });

  describe('$from', () => {
    it('should have method `$from` with proper handling of type, where operators, parsers', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(chatData);
      const [AuthorId1, AuthorId2] = await db.user
        .pluck('Id')
        .insertMany([userData, userData]);

      await db.message.createMany([
        { ...messageData, ChatId, AuthorId: AuthorId1 },
        { ...messageData, ChatId, AuthorId: AuthorId2 },
        { ...messageData, ChatId, AuthorId: AuthorId2 },
      ]);

      const inner = db.user.select('createdAt', {
        alias: 'Name',
        messagesCount: (q) => q.messages.count(),
      });

      const q = db.$from(inner).where({
        messagesCount: { gte: 1 },
      });

      assertType<
        Awaited<typeof q>,
        { createdAt: Date; alias: string; messagesCount: number }[]
      >();

      expectSql(
        q.toSQL(),
        `SELECT * FROM (
        SELECT
          "user"."created_at" "createdAt",
          "user"."name" "alias",
          "messagesCount".r "messagesCount"
        FROM "user"
        LEFT JOIN LATERAL (
          SELECT count(*) r
          FROM "message" "messages"
          WHERE ("messages"."author_id" = "user"."id" AND "messages"."message_key" = "user"."user_key")
            AND ("messages"."deleted_at" IS NULL)
        ) "messagesCount" ON true
      ) "user"
      WHERE "user"."messagesCount" >= $1`,
        [1],
      );

      const result = await q;
      expect(result).toEqual([
        {
          createdAt: expect.any(Date),
          alias: 'name',
          messagesCount: 1,
        },
        {
          createdAt: expect.any(Date),
          alias: 'name',
          messagesCount: 2,
        },
      ]);
    });
  });
});
