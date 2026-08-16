import {
  bundleOrchidORM,
  bundleOrchidORMTables,
  makeOrchidOrmDbWithAdapter,
  orchidORMWithAdapter,
} from './orm';
import { useTestORM } from './test-utils/orm.test-utils';
import {
  db,
  defineTable,
  defineView,
  assertType,
  expectSql,
  MessageData,
  ChatData,
  UserData,
  sql,
  testAdapter,
} from 'test-utils';
import { Db, QueryHelperResult } from 'pqb';

describe('orm', () => {
  useTestORM();

  const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
  }));

  const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
    id: t.identity().primaryKey(),
  }));

  it('should return object with provided adapter, close and transaction method, tables', () => {
    const local = orchidORMWithAdapter(
      { db: db.$qb },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    expect('$adapterNotInTransaction' in local).toBe(true);
    expect(local.$close).toBeInstanceOf(Function);
    expect(local.$transaction).toBeInstanceOf(Function);
    expect(Object.keys(local)).toEqual(
      expect.arrayContaining(['user', 'profile']),
    );
  });

  it('should be able to turn on autoPreparedStatements', () => {
    const local = orchidORMWithAdapter(
      { db: db.$qb, autoPreparedStatements: true },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    expect(local.user.q.autoPreparedStatements).toBe(true);
  });

  describe('bundleOrchidORMTables', () => {
    const BundleUserTable = defineTable('user', { schema: 'schema' }, (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      deletedAt: t.timestamp().nullable(),
    }))
      .softDelete()
      .scopes({
        named: (q) => q.where({ name: 'name' }),
      })
      .relations((user) => ({
        profile: user('id').hasOne(() => BundleProfileTable('userId')),
      }));

    const BundleProfileTable = defineTable(
      'profile',
      { schema: 'schema' },
      (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().foreignKey(() => BundleUserTable, 'id'),
        bio: t.text(),
      }),
    ).relations((profile) => ({
      user: profile('userId').belongsTo(() => BundleUserTable('id')),
    }));

    it('should return table keys only and keep internals non-enumerable', () => {
      const orm = bundleOrchidORM({
        tables: {
          user: BundleUserTable,
          profile: BundleProfileTable,
        },
      });

      expect(Object.keys(orm)).toEqual(['user', 'profile']);
      expect('$query' in orm).toBe(false);
      expect('$transaction' in orm).toBe(false);
    });

    it('should expose static table name on bundled tables and keep helper usage', () => {
      const orm = bundleOrchidORM({
        tables: {
          user: BundleUserTable,
          profile: BundleProfileTable,
        },
      });

      expect(orm.user.table).toBe('user');
      expect('schema' in orm.user).toBe(false);
      expect('columns' in orm.user).toBe(false);
      expect('softDelete' in orm.user).toBe(false);
      expect('scopes' in orm.user).toBe(false);
      expect('$query' in orm.user).toBe(false);
      expect(Object.keys(orm.user)).toEqual(['table', 'makeHelper']);
      assertType<typeof orm.user.table, 'user'>();
      // @ts-expect-error schema is table-class-only metadata.
      orm.user.schema;
      // @ts-expect-error columns is table-class-only metadata.
      orm.user.columns;

      const helper = orm.user.makeHelper((q) => q.select('id'));
      assertType<Awaited<QueryHelperResult<typeof helper>>, { id: number }[]>();
      const local = makeOrchidOrmDbWithAdapter(orm, { db: db.$qb });

      expectSql(
        helper(local.user).toSQL(),
        `
          SELECT "user"."id"
          FROM "schema"."user"
          WHERE ("user"."deleted_at" IS NULL)
        `,
      );

      const query = local.user.find(1).modify(helper);
      assertType<Awaited<typeof query>, { id: number }>();

      expectSql(
        query.toSQL(),
        `
          SELECT "user"."id"
          FROM "schema"."user"
          WHERE ("user"."id" = $1)
            AND ("user"."deleted_at" IS NULL)
          LIMIT 1
        `,
        [1],
      );
    });

    it('should expose bundled views under $views and bind helpers', () => {
      const BundleActiveUserView = defineView(
        'active_user',
        {
          schema: 'schema',
          sql: 'SELECT id, name FROM "user"',
        },
        (t) => ({
          id: t.integer(),
          name: t.text(),
        }),
      );

      const orm = bundleOrchidORM({
        views: {
          activeUser: BundleActiveUserView,
        },
      });

      expect(Object.keys(orm)).toEqual(['$views']);
      expect(Object.keys(orm.$views)).toEqual(['activeUser']);
      expect(orm.$views.activeUser.table).toBe('active_user');

      const helper = orm.$views.activeUser.makeHelper((q) => q.select('id'));
      const local = makeOrchidOrmDbWithAdapter(orm, { db: db.$qb });

      expectSql(
        helper(local.$views.activeUser).toSQL(),
        `
          SELECT "active_user"."id"
          FROM "schema"."active_user"
        `,
      );
    });
  });

  describe('makeOrchidOrmDbWithAdapter', () => {
    it('should bind a bundled ORM to DB options and expose ORM methods', () => {
      const orm = bundleOrchidORMTables({
        user: UserTable,
        profile: ProfileTable,
      });

      const local = makeOrchidOrmDbWithAdapter(orm, {
        db: db.$qb,
      });

      expect('$query' in local).toBe(true);
      expect('$transaction' in local).toBe(true);
      expect(local.$close).toBeInstanceOf(Function);
      expect(local.user.definedAs).toBe('user');
    });

    it('should keep bundle table-only and create a fresh ORM instance per bind', () => {
      const orm = bundleOrchidORMTables({
        user: UserTable,
      });

      const first = makeOrchidOrmDbWithAdapter(orm, {
        adapter: testAdapter,
      });
      const second = makeOrchidOrmDbWithAdapter(orm, {
        adapter: testAdapter,
      });

      expect('$query' in orm).toBe(false);
      expect(first).not.toBe(second);
      expect(first.$qb).not.toBe(second.$qb);
      expect(first.user).not.toBe(second.user);
      expect(first.user).not.toBe(orm.user);
      expect(second.user).not.toBe(orm.user);
    });

    it('should run table init hook for every created DB-aware instance', () => {
      const initSpy = jest.fn();

      const InitTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      })).init((localOrm) => {
        initSpy(localOrm);
      });

      const orm = bundleOrchidORMTables({
        user: InitTable,
      });

      const first = makeOrchidOrmDbWithAdapter(orm, {
        adapter: testAdapter,
      });
      const second = makeOrchidOrmDbWithAdapter(orm, {
        adapter: testAdapter,
      });

      expect(initSpy).toHaveBeenCalledTimes(2);
      expect(initSpy).toHaveBeenNthCalledWith(1, first);
      expect(initSpy).toHaveBeenNthCalledWith(2, second);
    });
  });

  describe('query methods', () => {
    it('should select independent query and expression results', async () => {
      const result = await db.$select({
        userCount: () => db.user.count(),
        one: () => sql<number>`1::int`,
      });

      assertType<typeof result, { userCount: number; one: number }>();

      expect(result).toEqual({ userCount: 0, one: 1 });
    });

    it('should perform a query with the $query method', async () => {
      const spy = jest.spyOn(db.$qb as Db, 'query');

      await db.$query`SELECT 1`;

      expect(spy).toHaveBeenCalledWith`SELECT 1`;
    });

    it('should query arrays with the $queryArrays method', async () => {
      const spy = jest.spyOn(db.$qb as Db, 'queryArrays');

      await db.$queryArrays`SELECT 1`;

      expect(spy).toHaveBeenCalledWith`SELECT 1`;
    });
  });

  describe('$from', () => {
    it('should have method `$from` with proper handling of type, where operators, parsers', async () => {
      const ChatId = await db.chat.get('IdOfChat').create(ChatData);
      const [AuthorId1, AuthorId2] = await db.user
        .pluck('Id')
        .insertMany([UserData, UserData]);

      await db.message.createMany([
        { ...MessageData, ChatId, AuthorId: AuthorId1 },
        { ...MessageData, ChatId, AuthorId: AuthorId2 },
        { ...MessageData, ChatId, AuthorId: AuthorId2 },
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
          "User"."created_at" "createdAt",
          "User"."name" "alias",
          "messagesCount"."messagesCount" "messagesCount"
        FROM "schema"."user" "User"
        LEFT JOIN LATERAL (
          SELECT count(*) "messagesCount"
          FROM "schema"."message" "messages"
          WHERE ("messages"."author_id" = "User"."id" AND "messages"."message_key" = "User"."user_key")
            AND ("messages"."deleted_at" IS NULL)
        ) "messagesCount" ON true
      ) "User"
      WHERE "User"."messagesCount" >= $1`,
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

  describe('$getAdapter', () => {
    it('should proxy call the $qb.$getAdapter', () => {
      const spy = jest
        .spyOn(db.$qb, '$getAdapter')
        .mockReturnValueOnce(testAdapter);

      const result = db.$getAdapter();

      expect(result).toBe(testAdapter);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
