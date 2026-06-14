import {
  bundleOrchidORMTables,
  makeOrchidOrmDbWithAdapter,
  orchidORMWithAdapter,
  setGrants,
} from './orm';
import { useTestORM } from './test-utils/orm.test-utils';
import {
  BaseTable,
  db,
  assertType,
  expectSql,
  MessageData,
  ChatData,
  UserData,
  testAdapter,
} from 'test-utils';
import { createBaseTable, Selectable } from './orm-table/base-table';
import { raw, QuerySchema, RawSql } from 'pqb/internal';
import { Db, QueryHelperResult } from 'pqb';

describe('orm', () => {
  useTestORM();

  type User = Selectable<UserTable>;
  class UserTable extends BaseTable {
    schema = () => 'schema';
    readonly table = 'user';
    filePath = 'orm.test.ts';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));
  }

  class ProfileTable extends BaseTable {
    schema = () => 'schema';
    readonly table = 'profile';
    filePath = 'orm.test.ts';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
    }));
  }

  it('should set snake case name for computed columns when initializing the same table twice', () => {
    const BaseTable = createBaseTable({
      snakeCase: true,
    });
    const { sql } = BaseTable;
    let fullNameSql: RawSql | undefined;
    const getColumnName = (column: unknown) =>
      (column as { data: { name?: string } }).data.name;

    class Table extends BaseTable {
      readonly table = 'user';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        firstName: t.text(),
        lastName: t.text(),
      }));

      computed = this.setComputed((q) => ({
        fullName: (fullNameSql ??= sql<string>`${q.column(
          'firstName',
        )} || ' ' || ${q.column('lastName')}`),
      }));
    }

    const firstDb = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        user: Table,
      },
    );
    const firstName = getColumnName(firstDb.user.shape.fullName);

    const secondDb = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        user: Table,
      },
    );

    expect({
      firstName,
      secondName: getColumnName(secondDb.user.shape.fullName),
    }).toEqual({
      firstName: undefined,
      secondName: undefined,
    });
  });

  it('should use child schema override when parent instance was created first', () => {
    const BaseTable = createBaseTable();

    class ParentTable extends BaseTable {
      schema: QuerySchema = () => 'tenant';
      readonly table = 'item';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
    }

    class ChildTable extends ParentTable {
      schema: QuerySchema = 'saas';
    }

    orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        parent: ParentTable,
      },
    );

    const local = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        item: ChildTable,
      },
    );

    expectSql(
      local.item.select('id').toSQL(),
      `
        SELECT "item"."id"
        FROM "saas"."item"
      `,
    );
  });

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

    const local = orchidORMWithAdapter(
      { db: db.$qb },
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

  it('should return table which is a queryable interface', async () => {
    const local = orchidORMWithAdapter(
      { db: db.$qb },
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
        FROM "schema"."user"
        WHERE "user"."id" > $1
      `,
      [0],
    );

    const result = await query;
    expect(result).toEqual([{ id, name }]);

    assertType<typeof result, Pick<User, 'id' | 'name'>[]>();
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

  describe('grants', () => {
    class GrantsTable extends BaseTable {
      readonly table = 'grants';
      filePath = 'orm.test.ts';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
      }));
      grants = setGrants([
        {
          to: 'app_user',
          grantedBy: 'owner',
          privileges: ['SELECT'],
          grantablePrivileges: ['UPDATE'],
        },
      ]);
    }

    it('should pass grants through ORM setup to the query builder', () => {
      const local = orchidORMWithAdapter(
        {
          adapter: testAdapter,
          defaultGrantedBy: 'owner',
          grants: [
            {
              to: ['app_user', 'readonly'],
              grantedBy: 'admin',
              allTablesIn: ['public'],
              privileges: ['SELECT'],
            },
          ],
        },
        {
          user: UserTable,
        },
      );

      const internalGrants = local.$qb.internal.grants;
      expect(internalGrants).toEqual([
        {
          to: ['app_user', 'readonly'],
          grantedBy: 'admin',
          allTablesIn: ['public'],
          privileges: ['SELECT'],
        },
      ]);
      expect(local.$qb.internal.defaultGrantedBy).toBe('owner');
    });

    it('should not expose generatorIgnore to SQL or break ORM bounds yet', () => {
      const local = orchidORMWithAdapter(
        {
          adapter: testAdapter,
          generatorIgnore: {
            grants: {
              roles: ['external'],
            },
          },
        },
        {
          user: UserTable,
        },
      );

      expect(local.$qb.internal.generatorIgnore).toEqual({
        grants: {
          roles: ['external'],
        },
      });
    });

    it('should preserve table grants on db-bound table internals', () => {
      const grants = setGrants([
        {
          to: 'reporting_user',
          privileges: ['SELECT'],
        },
      ]);

      const local = orchidORMWithAdapter(
        {
          adapter: testAdapter,
        },
        {
          grants: GrantsTable,
        },
      );

      expect(grants).toEqual([
        {
          to: 'reporting_user',
          privileges: ['SELECT'],
        },
      ]);
      expect(local.grants.internal.tableGrants).toEqual([
        {
          to: 'app_user',
          grantedBy: 'owner',
          privileges: ['SELECT'],
          grantablePrivileges: ['UPDATE'],
        },
      ]);
      expect(
        (local.grants as unknown as { setGrants?: unknown }).setGrants,
      ).toBe(undefined);
    });
  });

  describe('bundleOrchidORMTables', () => {
    class BundleUserTable extends BaseTable {
      schema: QuerySchema = 'schema';
      readonly table = 'user';
      filePath = 'orm.test.ts';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        deletedAt: t.timestamp().nullable(),
      }));

      readonly softDelete = true;

      scopes = this.setScopes({
        named: (q) => q.where({ name: 'name' }),
      });

      relations = {
        profile: this.hasOne(() => BundleProfileTable, {
          columns: ['id'],
          references: ['userId'],
        }),
      };
    }

    class BundleProfileTable extends BaseTable {
      schema: QuerySchema = 'schema';
      readonly table = 'profile';
      filePath = 'orm.test.ts';
      columns = this.setColumns((t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer().foreignKey(() => BundleUserTable, 'id'),
        bio: t.text(),
      }));

      relations = {
        user: this.belongsTo(() => BundleUserTable, {
          columns: ['userId'],
          references: ['id'],
        }),
      };
    }

    it('should return table keys only and keep internals non-enumerable', () => {
      const orm = bundleOrchidORMTables({
        user: BundleUserTable,
        profile: BundleProfileTable,
      });

      expect(Object.keys(orm)).toEqual(['user', 'profile']);
      expect('$query' in orm).toBe(false);
      expect('$transaction' in orm).toBe(false);
    });

    it('should expose static table name on bundled tables and keep helper usage', () => {
      const orm = bundleOrchidORMTables({
        user: BundleUserTable,
        profile: BundleProfileTable,
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

      class InitTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          name: t.text(),
        }));

        init = (localOrm: unknown) => {
          initSpy(localOrm);
        };
      }

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
          "user"."created_at" "createdAt",
          "user"."name" "alias",
          "messagesCount"."messagesCount" "messagesCount"
        FROM "schema"."user"
        LEFT JOIN LATERAL (
          SELECT count(*) "messagesCount"
          FROM "schema"."message" "messages"
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
