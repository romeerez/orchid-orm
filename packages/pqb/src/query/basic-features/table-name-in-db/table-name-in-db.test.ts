import { expectSql, testAdapter } from 'test-utils';
import { createDbWithAdapter } from '../../db';
import { refreshMaterializedView } from '../../extra-features/materialized-view/materialized-view.query';

describe('table name in db', () => {
  it('resolves database relation names for standalone tables', () => {
    const db = createDbWithAdapter({
      adapter: testAdapter,
      snakeCase: true,
    });

    const Default = db('defaultName', (t) => ({
      id: t.identity().primaryKey(),
    }));
    const Explicit = db(
      'Explicit',
      (t) => ({
        id: t.identity().primaryKey(),
      }),
      undefined,
      { nameInDb: 'custom_name' },
    );
    const Snake = db('SnakeName', (t) => ({
      id: t.identity().primaryKey(),
    }));
    const Same = db('same_name', (t) => ({
      id: t.identity().primaryKey(),
    }));

    expect(Default.table).toBe('defaultName');
    expect(Default.q.nameInDb).toBe('default_name');
    expect(Explicit.table).toBe('Explicit');
    expect(Explicit.q.nameInDb).toBe('custom_name');
    expect(Explicit.clone().q.nameInDb).toBe('custom_name');
    expect(Snake.q.nameInDb).toBe('snake_name');
    expect(Same.q.nameInDb).toBe('same_name');
  });

  it('renders database relation names with query-facing table aliases', () => {
    const db = createDbWithAdapter({
      adapter: testAdapter,
      snakeCase: true,
    });

    const User = db('User', (t) => ({
      id: t.identity().primaryKey(),
      name: t.text(),
    }));
    const Profile = db(
      'Profile',
      (t) => ({
        id: t.identity().primaryKey(),
        userId: t.integer(),
      }),
      undefined,
      { nameInDb: 'profiles' },
    );

    expectSql(
      User.select('id').where({ name: 'name' }).toSQL(),
      `
        SELECT "User"."id" FROM "user" "User"
        WHERE "User"."name" = $1
      `,
      ['name'],
    );

    expectSql(
      User.as('u').select('u.id').toSQL(),
      `
        SELECT "u"."id" FROM "user" "u"
      `,
    );

    expectSql(
      User.join(Profile, 'Profile.userId', 'User.id')
        .select('User.id', 'Profile.id')
        .toSQL(),
      `
        SELECT "User"."id", "Profile"."id"
        FROM "user" "User"
        JOIN "profiles" "Profile" ON "Profile"."user_id" = "User"."id"
      `,
    );
  });

  it('renders schema-qualified and mutation SQL with database relation names', async () => {
    const db = createDbWithAdapter({
      adapter: testAdapter,
      snakeCase: true,
    });

    const User = db(
      'User',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
      }),
      undefined,
      {
        schema: 'app',
      },
    );
    const ReportView = db(
      'ReportView',
      (t) => ({
        id: t.identity().primaryKey(),
      }),
      undefined,
      {
        materialized: true,
        readOnly: true,
      },
    );

    expectSql(
      User.select('id').toSQL(),
      `
        SELECT "User"."id" FROM "app"."user" "User"
      `,
    );

    expectSql(
      User.create({ name: 'name' }).toSQL(),
      `
        INSERT INTO "app"."user" AS "User"("name")
        VALUES ($1)
        RETURNING *
      `,
      ['name'],
    );

    expectSql(User.truncate().toSQL(), 'TRUNCATE "app"."user"');

    const query = jest
      .spyOn(ReportView.q.adapter, 'query')
      .mockResolvedValue({ rowCount: 0, rows: [], fields: [] });

    await refreshMaterializedView(ReportView, { withData: false });

    expect(query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW "report_view" WITH NO DATA',
      [],
    );

    query.mockRestore();
  });
});
