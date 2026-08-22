import {
  DefaultSelect,
  Insertable,
  Queryable,
  Selectable,
  Updatable,
} from './legacy-table';
import {
  assertType,
  db,
  defineTable,
  defineView,
  expectSql,
  ProfileData,
  sql,
  testAdapter,
  testOrchidORMWithAdapter,
  useTestDatabase,
  UserData,
  zodSchemaConfig,
} from 'test-utils';
import { createTableFactory } from './table';
import { z } from 'zod/v4';
import {
  bundleOrchidORM,
  makeOrchidOrmDbWithAdapter,
  orchidORMWithAdapter,
} from '../orm-instance/orm-instance';
import { QueryHelperResult } from 'pqb';
import { CannotMutateReadOnlyTableError } from 'pqb/internal';

describe('view', () => {
  useTestDatabase();

  it('should be queryable just as normal table', async () => {
    await db.user.createMany([
      {
        ...UserData,
        Active: false,
        profile: {
          create: ProfileData,
        },
      },
      {
        ...UserData,
        Active: true,
        profile: {
          create: ProfileData,
        },
      },
    ]);

    const count = await db.$views.activeUserWithProfile.count();
    expect(count).toBe(1);
  });

  it('should support basic regular view', () => {
    const { defineView, sql } = createTableFactory();
    const ActiveUserView = defineView(
      'activeUser',
      { sql: sql`SELECT "id", "name" FROM "user" WHERE "active" = true` },
      (t) => ({
        id: t.integer(),
        name: t.text(),
      }),
    );
    const UserNameView = defineView('userName', (t) => ({
      id: t.integer(),
      name: t.text(),
    }));

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { activeUser: ActiveUserView, userName: UserNameView },
      },
      {},
    );

    const query = db.$views.activeUser.select('id', 'name');
    const noOptionsQuery = db.$views.userName.select('id', 'name');

    assertType<typeof db.$views.activeUser.__readOnly, true>();
    assertType<typeof db.$views.userName.__readOnly, true>();
    assertType<Awaited<typeof query>, { id: number; name: string }[]>();
    assertType<
      Awaited<typeof noOptionsQuery>,
      { id: number; name: string }[]
    >();
    assertType<typeof ActiveUserView.data.name, 'activeUser'>();
    assertType<typeof ActiveUserView.data.table, undefined>();

    expectSql(
      query.toSQL(),
      `
        SELECT "activeUser"."id", "activeUser"."name"
        FROM "activeUser"
      `,
    );
    expectSql(
      noOptionsQuery.toSQL(),
      `
        SELECT "userName"."id", "userName"."name"
        FROM "userName"
      `,
    );
  });

  it('should support view in bundleOrchidORM', () => {
    const { defineView } = createTableFactory();
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      name: t.text(),
    }));
    const orm = bundleOrchidORM({ views: { activeUser: ActiveUserView } });
    const helper = orm.$views.activeUser.makeHelper((q) =>
      q.select('id', 'name'),
    );

    assertType<
      Awaited<QueryHelperResult<typeof helper>>,
      { id: number; name: string }[]
    >();

    const db = makeOrchidOrmDbWithAdapter(orm, {
      adapter: testAdapter,
    });

    expectSql(
      db.$views.activeUser.useHelper(helper).toSQL(),
      `
        SELECT "activeUser"."id", "activeUser"."name" FROM "activeUser"
      `,
    );
  });

  it('should support view in makeOrchidOrmDbWithAdapter', () => {
    const { defineView } = createTableFactory();
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      name: t.text(),
    }));
    const orm = bundleOrchidORM({ views: { activeUser: ActiveUserView } });
    const db = makeOrchidOrmDbWithAdapter(orm, { adapter: testAdapter });
    const query = db.$views.activeUser.select('id', 'name');

    assertType<Awaited<typeof query>, { id: number; name: string }[]>();

    expectSql(
      db.$views.activeUser.toSQL(),
      `
        SELECT * FROM "activeUser"
      `,
    );
  });

  it('should support writable regular view', () => {
    const { defineView, sql } = createTableFactory();
    const WritableUserView = defineView(
      'writableUser',
      {
        readOnly: false,
        sql: sql`SELECT "id", "name" FROM "user"`,
      },
      (t) => ({
        id: t.integer().primaryKey(),
        name: t.text(),
      }),
    );

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { writableUser: WritableUserView },
      },
      {},
    );

    const query = db.$views.writableUser.select('id', 'name');

    // intentionally not awaited, just ensuring there is no TS errors here
    const createQuery = db.$views.writableUser.create({
      id: 1,
      name: 'name',
    });

    expectSql(
      createQuery.toSQL(),
      `
        INSERT INTO "writableUser"("id", "name") VALUES ($1, $2) RETURNING *
      `,
      [1, 'name'],
    );

    assertType<typeof db.$views.writableUser.__readOnly, undefined>();
    assertType<Awaited<typeof query>, { id: number; name: string }[]>();
    assertType<typeof createQuery.__readOnly, undefined>();
    assertType<Awaited<typeof createQuery>, { id: number; name: string }>();
  });

  it('should throw when mutating a read-only view', () => {
    expect(() =>
      // @ts-expect-error first-class views are read-only by default
      db.$views.activeUser.create({ id: 1, name: 'name' }),
    ).toThrow(CannotMutateReadOnlyTableError);
  });

  it('should support materialized view', () => {
    const { defineView, sql } = createTableFactory();
    const MonthlySaleView = defineView(
      'monthlySale',
      {
        materialized: true,
        withData: false,
        sql: sql`SELECT "userId", "month", "total" FROM "sale"`,
      },
      (t) => ({
        userId: t.integer(),
        month: t.date(),
        total: t.integer(),
      }),
    );

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { monthlySale: MonthlySaleView },
      },
      {},
    );

    const query = db.$views.monthlySale.select('userId', 'month');

    assertType<typeof db.$views.monthlySale.__readOnly, true>();
    assertType<typeof db.$views.monthlySale.__materialized, true>();
    assertType<
      Awaited<typeof query>,
      {
        userId: number;
        month: string;
      }[]
    >();

    expectSql(
      query.toSQL(),
      `
        SELECT "monthlySale"."userId", "monthlySale"."month"
        FROM "monthlySale"
      `,
    );
  });

  it('should expose materialized views under $views as read-only materialized queries', () => {
    const MonthlySalesView = defineView(
      'monthlySales',
      {
        schema: 'analytics',
        materialized: true,
        withData: false,
        sql: sql`SELECT "userId", "month", "total" FROM "sale"`,
      },
      (t) => ({
        userId: t.integer(),
        month: t.date(),
        total: t.decimal(),
      }),
    ).grants([
      {
        to: 'reader',
        privileges: ['SELECT'],
      },
    ]);

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          monthlySales: MonthlySalesView,
        },
      },
      {},
    );

    const query = local.$views.monthlySales
      .select('userId', 'month')
      .where({ userId: 1 });

    assertType<typeof local.$views.monthlySales.__readOnly, true>();
    assertType<typeof local.$views.monthlySales.__materialized, true>();
    assertType<typeof query.__materialized, true>();

    expectSql(
      query.toSQL(),
      `
        SELECT "monthlySales"."user_id" "userId", "monthlySales"."month"
        FROM "analytics"."monthly_sales" "monthlySales"
        WHERE "monthlySales"."user_id" = $1
      `,
      [1],
    );

    expect(local.$views.monthlySales.internal.materialized).toBe(true);
    expect(local.$views.monthlySales.internal.tableGrants).toEqual([
      {
        to: 'reader',
        privileges: ['SELECT'],
      },
    ]);
    expect(() =>
      // @ts-expect-error materialized views are always read-only
      local.$views.monthlySales.create({
        userId: 1,
        month: new Date(),
        total: '1',
      }),
    ).toThrow(CannotMutateReadOnlyTableError);
  });

  it('should keep materialized views read-only even when readOnly is false', () => {
    const WritableAttemptView = defineView(
      'writableAttempt',
      {
        materialized: true,
        readOnly: false,
        sql: sql`SELECT id FROM "user"`,
      },
      (t) => ({
        id: t.integer(),
      }),
    );

    const local = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          writableAttempt: WritableAttemptView,
        },
      },
      {},
    );

    assertType<typeof local.$views.writableAttempt.__readOnly, true>();
    expect(() =>
      // @ts-expect-error materialized views are always read-only
      local.$views.writableAttempt.create({ id: 1 }),
    ).toThrow(CannotMutateReadOnlyTableError);
  });

  it('should expose materialized views in split ORM setup', () => {
    const BundleActiveUserView = defineView(
      'activeUser',
      { materialized: true, sql: sql`SELECT id FROM "user"` },
      (t) => ({
        id: t.integer(),
      }),
    );

    const orm = bundleOrchidORM({
      views: {
        activeUser: BundleActiveUserView,
      },
    });
    const local = makeOrchidOrmDbWithAdapter(orm, { adapter: testAdapter });

    assertType<typeof local.$views.activeUser.__materialized, true>();
    expect(Object.keys(orm)).toEqual(['$views']);
    expect(Object.keys(orm.$views)).toEqual(['activeUser']);
    expect(orm.$views.activeUser.table).toBe('activeUser');
    expectSql(
      local.$views.activeUser.select('id').toSQL(),
      `
        SELECT "activeUser"."id"
        FROM "active_user" "activeUser"
      `,
    );
  });

  it('should support view type helpers', () => {
    const { defineView, sql } = createTableFactory();
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.identity().primaryKey(),
      visible: t.text().parse(() => true),
      hidden: t.text().select(false),
      optional: t.text().default('text'),
      required: t.boolean(),
    }));
    const WritableUserView = defineView(
      'writableUser',
      {
        readOnly: false,
        sql: sql`SELECT "id", "visible", "hidden", "optional", "required" FROM "user"`,
      },
      (t) => ({
        id: t.identity().primaryKey(),
        visible: t.text().parse(() => true),
        hidden: t.text().select(false),
        optional: t.text().default('text'),
        required: t.boolean(),
      }),
    );
    const MonthlySaleView = defineView(
      'monthlySale',
      {
        materialized: true,
        sql: sql`SELECT "id", "visible", "hidden", "optional", "required" FROM "sale"`,
      },
      (t) => ({
        id: t.identity().primaryKey(),
        visible: t.text().parse(() => true),
        hidden: t.text().select(false),
        optional: t.text().default('text'),
        required: t.boolean(),
      }),
    );

    type ExpectedQueryable = {
      id?: number;
      visible?: string;
      hidden?: string;
      optional?: string;
      required?: boolean;
    };
    type ExpectedDefaultSelect = {
      id: number;
      visible: boolean;
      optional: string;
      required: boolean;
    };
    type ExpectedSelectable = {
      id: number;
      visible: boolean;
      hidden: string;
      optional: string;
      required: boolean;
    };
    type ExpectedInsertable = {
      id?: number;
      visible: string;
      hidden: string;
      optional?: string;
      required: boolean;
    };
    type ExpectedUpdatable = {
      id?: number;
      visible?: string;
      hidden?: string;
      optional?: string;
      required?: boolean;
    };

    assertType<Queryable<typeof ActiveUserView>, ExpectedQueryable>();
    assertType<DefaultSelect<typeof ActiveUserView>, ExpectedDefaultSelect>();
    assertType<Selectable<typeof ActiveUserView>, ExpectedSelectable>();
    assertType<Insertable<typeof WritableUserView>, ExpectedInsertable>();
    assertType<Updatable<typeof WritableUserView>, ExpectedUpdatable>();
    assertType<Queryable<typeof MonthlySaleView>, ExpectedQueryable>();
    assertType<DefaultSelect<typeof MonthlySaleView>, ExpectedDefaultSelect>();
    assertType<Selectable<typeof MonthlySaleView>, ExpectedSelectable>();
  });

  it('should support validation schema methods on view definitions', () => {
    const { defineView, sql } = createTableFactory({
      schemaConfig: zodSchemaConfig,
    });
    const TestView = defineView(
      'testView',
      {
        readOnly: false,
        sql: sql`SELECT "id", "name" FROM "test"`,
      },
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }),
    );

    const viewInputSchema = TestView.inputSchema();
    const viewOutputSchema = TestView.outputSchema();
    const viewQuerySchema = TestView.querySchema();
    const viewPkeySchema = TestView.pkeySchema();
    const viewCreateSchema = TestView.createSchema();
    const viewUpdateSchema = TestView.updateSchema();

    const expected = z.object({ id: z.number(), name: z.string() });
    const expectedQuery = expected.partial();
    const expectedPkey = expected.pick({ id: true });
    const expectedCreate = expected.omit({ id: true });
    const expectedUpdate = expectedCreate.partial();

    assertType<typeof viewInputSchema, typeof expected>();
    assertType<typeof viewOutputSchema, typeof expected>();
    assertType<typeof viewQuerySchema, typeof expectedQuery>();
    assertType<typeof viewPkeySchema, typeof expectedPkey>();
    assertType<typeof viewCreateSchema, typeof expectedCreate>();
    assertType<typeof viewUpdateSchema, typeof expectedUpdate>();

    expect(viewInputSchema.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
      name: 'name',
    });
    expect(viewOutputSchema.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
      name: 'name',
    });
    expect(viewQuerySchema.parse({ name: 'name' })).toEqual({
      name: 'name',
    });
    expect(viewPkeySchema.parse({ id: 1, name: 'name' })).toEqual({
      id: 1,
    });
    expect(viewCreateSchema.parse({ name: 'name' })).toEqual({
      name: 'name',
    });
    expect(viewUpdateSchema.parse({})).toEqual({});

    expect(() => viewInputSchema.parse({ id: '1', name: 'name' })).toThrow(
      'Invalid input: expected number, received string',
    );
    expect(() => viewQuerySchema.parse({ id: '1' })).toThrow(
      'Invalid input: expected number, received string',
    );
    expect(viewPkeySchema.safeParse({}).success).toBe(false);
  });

  it('should support view option', () => {
    const { defineView, sql } = createTableFactory({ snakeCase: true });

    const ActiveUserView = defineView(
      'activeUser',
      {
        schema: 'custom',
        nameInDb: 'active_user',
        snakeCase: false,
        language: 'english',
        readOnly: false,
        generatorIgnore: true,
        sql: sql`SELECT "id", "userName" FROM "user"`,
        recursive: true,
        checkOption: 'LOCAL',
        securityBarrier: true,
        securityInvoker: true,
      },
      (t) => ({
        id: t.integer().primaryKey(),
        userName: t.text(),
      }),
    );

    const ActiveUserMaterializedView = defineView(
      'activeUserMaterialized',
      {
        schema: 'custom',
        nameInDb: 'active_user_materialized',
        snakeCase: true,
        language: 'simple',
        readOnly: false,
        generatorIgnore: true,
        materialized: true,
        withData: false,
        sql: sql`SELECT "id", "user_name" FROM "user"`,
      },
      (t) => ({
        id: t.integer(),
        userName: t.text(),
      }),
    );

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          activeUser: ActiveUserView,
          activeUserMaterialized: ActiveUserMaterializedView,
        },
      },
      {},
    );

    assertType<typeof db.$views.activeUser.__readOnly, undefined>();
    assertType<typeof db.$views.activeUserMaterialized.__readOnly, true>();
    assertType<typeof db.$views.activeUser.__materialized, undefined>();
    assertType<typeof db.$views.activeUserMaterialized.__materialized, true>();
  });

  it('should reject duplicate database names across tables and views', () => {
    const UserTable = defineTable('user', { schema: 'custom' }, (t) => ({
      id: t.integer().primaryKey(),
    }));
    const DuplicateUserView = defineView(
      'user',
      { schema: 'custom', sql: sql`SELECT id FROM "user"` },
      (t) => ({
        id: t.integer(),
      }),
    );

    expect(() =>
      orchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            user: DuplicateUserView,
          },
        },
        {
          user: UserTable,
        },
      ),
    ).toThrow(
      'Cannot configure both a table and a view for database relation custom.user',
    );
  });

  it('should reject duplicate database names across tables and materialized views', () => {
    const UserTable = defineTable('user', { schema: 'custom' }, (t) => ({
      id: t.integer().primaryKey(),
    }));
    const DuplicateUserView = defineView(
      'user',
      {
        schema: 'custom',
        materialized: true,
        sql: sql`SELECT id FROM "user"`,
      },
      (t) => ({
        id: t.integer(),
      }),
    );

    expect(() =>
      orchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            user: DuplicateUserView,
          },
        },
        {
          user: UserTable,
        },
      ),
    ).toThrow(
      'Cannot configure both a table and a view for database relation custom.user',
    );
  });

  it('should support query-defined view', () => {
    const { defineTable, defineView } = createTableFactory();
    const UserTable = defineTable('user', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
      active: t.boolean(),
    }));
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      name: t.text(),
    })).query((orm) => orm.user.select('id', 'name').where({ active: true }));

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { activeUser: ActiveUserView },
      },
      { user: UserTable },
    );

    const query = db.$views.activeUser.select('id', 'name');

    expectSql(
      query.toSQL(),
      `
        SELECT "activeUser"."id", "activeUser"."name"
        FROM "activeUser"
      `,
    );
  });

  it('should require query-defined views to return a query', () => {
    const { defineView } = createTableFactory();

    defineView('activeUser', (t) => ({
      id: t.integer(),
    })).query(
      // @ts-expect-error query callback must return a Query
      () => null,
    );
  });

  it('should support view computed column chain', () => {
    const { defineView } = createTableFactory();
    const UserNameView = defineView('userName', (t) => ({
      id: t.integer(),
      firstName: t.text(),
      lastName: t.text(),
    })).computed((q) => ({
      fullName: q.computeAtRuntime(
        ['firstName', 'lastName'],
        (record) => `${record.firstName} ${record.lastName}`,
      ),
    }));

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { userName: UserNameView },
      },
      {},
    );

    const query = db.$views.userName.get('fullName');

    expectSql(
      query.toSQL(),
      `
        SELECT "userName"."firstName", "userName"."lastName"
        FROM "userName"
        LIMIT 1
      `,
    );
  });

  it('should support view scopes chain', () => {
    const { defineView } = createTableFactory();
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      active: t.boolean(),
    })).scopes({
      active: (q) => q.where({ active: true }),
    });

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { activeUser: ActiveUserView },
      },
      {},
    );

    const query = db.$views.activeUser.scope('active');

    expectSql(
      query.toSQL(),
      `
        SELECT *
        FROM "activeUser"
        WHERE ("activeUser"."active" = $1)
      `,
      [true],
    );
  });

  it('should support view soft delete chain', () => {
    const { defineView } = createTableFactory();
    const DefaultSoftDeleteView = defineView(
      'defaultSoftDelete',
      { readOnly: false },
      (t) => ({
        id: t.integer(),
        name: t.text(),
        deletedAt: t.timestamp().asDate().nullable(),
      }),
    ).softDelete();
    const CustomSoftDeleteView = defineView(
      'customSoftDelete',
      { readOnly: false },
      (t) => ({
        id: t.integer(),
        name: t.text(),
        archivedAt: t.timestamp().asDate().nullable(),
      }),
    ).softDelete('archivedAt');

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: {
          defaultSoftDelete: DefaultSoftDeleteView,
          customSoftDelete: CustomSoftDeleteView,
        },
      },
      {},
    );

    const defaultQuery = db.$views.defaultSoftDelete.select(
      'id',
      'name',
      'deletedAt',
    );
    const customQuery = db.$views.customSoftDelete.select(
      'id',
      'name',
      'archivedAt',
    );

    expectSql(
      defaultQuery.toSQL(),
      `
        SELECT "defaultSoftDelete"."id", "defaultSoftDelete"."name", "defaultSoftDelete"."deletedAt"
        FROM "defaultSoftDelete"
        WHERE ("defaultSoftDelete"."deletedAt" IS NULL)
      `,
    );
    expectSql(
      customQuery.toSQL(),
      `
        SELECT "customSoftDelete"."id", "customSoftDelete"."name", "customSoftDelete"."archivedAt"
        FROM "customSoftDelete"
        WHERE ("customSoftDelete"."archivedAt" IS NULL)
      `,
    );

    expectSql(
      db.$views.defaultSoftDelete.all().hardDelete().toSQL(),
      `
        DELETE FROM "defaultSoftDelete"
      `,
    );
    expectSql(
      db.$views.customSoftDelete.all().hardDelete().toSQL(),
      `
        DELETE FROM "customSoftDelete"
      `,
    );
  });

  it('should support view grants chain', () => {
    const { defineView } = createTableFactory();
    const ActiveUserView = defineView('activeUser', (t) => ({
      id: t.integer(),
      name: t.text(),
    })).grants([{ to: 'app_user', privileges: ['SELECT'] }]);

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { activeUser: ActiveUserView },
      },
      {},
    );

    expect(db.$views.activeUser.internal.tableGrants).toEqual([
      { to: 'app_user', privileges: ['SELECT'] },
    ]);
  });

  it('should support view init hook chain', async () => {
    const { defineView } = createTableFactory();
    const UserView = defineView(
      'user',
      { schema: 'schema', readOnly: false },
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text(),
      }),
    ).init((_orm, hooks) => {
      hooks.beforeCreate(({ set }) => {
        set({ name: 'overridden' });
      });
    });

    const db = testOrchidORMWithAdapter(
      {
        adapter: testAdapter,
        views: { user: UserView },
      },
      {},
    );

    const user = await db.$views.user.create({
      name: 'name',
      password: 'password',
    });
    expect(user.name).toBe('overridden');
  });

  describe('nameInDb', () => {
    it('should resolve database relation names for views', () => {
      const { defineView, sql } = createTableFactory({ snakeCase: true });

      const ActiveUserView = defineView(
        'ActiveUser',
        { sql: sql`SELECT "id" FROM "user"` },
        (t) => ({
          id: t.integer(),
        }),
      );
      const ExplicitView = defineView(
        'ExplicitView',
        { nameInDb: 'custom_views', sql: sql`SELECT "id" FROM "user"` },
        (t) => ({
          id: t.integer(),
        }),
      );

      const db = testOrchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: {
            activeUser: ActiveUserView,
            explicit: ExplicitView,
          },
        },
        {},
      );

      expect(db.$views.activeUser.table).toBe('ActiveUser');
      expect(db.$views.activeUser.q.nameInDb).toBe('active_user');
      expect(db.$views.explicit.table).toBe('ExplicitView');
      expect(db.$views.explicit.q.nameInDb).toBe('custom_views');
    });

    it('should resolve database relation names for materialized views', () => {
      const { defineView, sql } = createTableFactory({ snakeCase: true });

      const MonthlySaleView = defineView(
        'MonthlySale',
        {
          materialized: true,
          withData: false,
          nameInDb: 'sales_by_month',
          sql: sql`SELECT "id" FROM "sale"`,
        },
        (t) => ({
          id: t.integer(),
        }),
      );

      const db = testOrchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: { monthlySale: MonthlySaleView },
        },
        {},
      );

      expect(db.$views.monthlySale.table).toBe('MonthlySale');
      expect(db.$views.monthlySale.q.nameInDb).toBe('sales_by_month');
    });

    it('should render SQL with database relation names for views', () => {
      const { defineView, sql } = createTableFactory({ snakeCase: true });

      const ActiveUserView = defineView(
        'ActiveUser',
        { sql: sql`SELECT "id", "name" FROM "user"` },
        (t) => ({
          id: t.integer(),
          name: t.text(),
        }),
      );

      const db = testOrchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: { activeUser: ActiveUserView },
        },
        {},
      );

      expectSql(
        db.$views.activeUser.select('id', 'name').toSQL(),
        `
          SELECT "ActiveUser"."id", "ActiveUser"."name"
          FROM "active_user" "ActiveUser"
        `,
      );
    });

    it('should render schema-qualified SQL with database relation names for views', () => {
      const { defineView, sql } = createTableFactory({ snakeCase: true });

      const ActiveUserView = defineView(
        'ActiveUser',
        { schema: 'custom', sql: sql`SELECT "id" FROM "user"` },
        (t) => ({
          id: t.integer(),
        }),
      );

      const db = testOrchidORMWithAdapter(
        {
          adapter: testAdapter,
          views: { activeUser: ActiveUserView },
        },
        {},
      );

      expectSql(
        db.$views.activeUser.select('id').toSQL(),
        `
          SELECT "ActiveUser"."id" FROM "custom"."active_user" "ActiveUser"
        `,
      );
    });

    it('should reject duplicate database names across tables and views', () => {
      const { defineTable, defineView, sql } = createTableFactory();

      const UserTable = defineTable('user', (t) => ({
        id: t.identity().primaryKey(),
      }));
      const DuplicateUserView = defineView(
        'DuplicateUser',
        { nameInDb: 'user', sql: sql`SELECT "id" FROM "user"` },
        (t) => ({
          id: t.integer(),
        }),
      );

      expect(() =>
        testOrchidORMWithAdapter(
          {
            adapter: testAdapter,
            views: { duplicateUser: DuplicateUserView },
          },
          { user: UserTable },
        ),
      ).toThrow(
        'Cannot configure both a table and a view for database relation user',
      );
    });
  });
});
