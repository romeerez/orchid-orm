import {
  db,
  expectSql,
  testAdapter,
  UserData,
  UserSelectAll,
} from 'test-utils';
import { createDbWithAdapter } from '../../db';
import { refreshMaterializedView } from '../../extra-features/materialized-view/materialized-view.query';

describe('table name in db', () => {
  it('resolves database relation names for standalone tables', () => {
    const localDb = createDbWithAdapter({
      adapter: testAdapter,
      snakeCase: true,
    });

    const Default = localDb('defaultName', (t) => ({
      id: t.identity().primaryKey(),
    }));
    const Explicit = localDb(
      'Explicit',
      (t) => ({
        id: t.identity().primaryKey(),
      }),
      undefined,
      { nameInDb: 'custom_name' },
    );
    const Snake = localDb('SnakeName', (t) => ({
      id: t.identity().primaryKey(),
    }));
    const Same = localDb('same_name', (t) => ({
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
    expectSql(
      db.user.select('Id').where({ Name: 'name' }).toSQL(),
      `
        SELECT "User"."id" "Id" FROM "schema"."user" "User"
        WHERE "User"."name" = $1
      `,
      ['name'],
    );

    expectSql(
      db.user.as('u').select('u.Id').toSQL(),
      `
        SELECT "u"."id" "Id" FROM "schema"."user" "u"
      `,
    );

    expectSql(
      db.user
        .join(db.profile, 'Profile.UserId', 'User.Id')
        .select('User.Id', 'Profile.Id')
        .toSQL(),
      `
        SELECT "User"."id" "Id", "Profile"."id" "Id"
        FROM "schema"."user" "User"
        JOIN "schema"."profile" "Profile" ON "Profile"."user_id" = "User"."id"
      `,
    );
  });

  it('renders schema-qualified and mutation SQL with database relation names', async () => {
    const localDb = createDbWithAdapter({
      adapter: testAdapter,
      snakeCase: true,
    });

    const ReportView = localDb(
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
      db.user.select('Id').toSQL(),
      `
        SELECT "User"."id" "Id" FROM "schema"."user" "User"
      `,
    );

    expectSql(
      db.user
        .create({
          Name: UserData.Name,
          UserKey: UserData.UserKey,
          Password: UserData.Password,
        })
        .toSQL(),
      `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
        VALUES ($1, $2, $3)
        RETURNING ${UserSelectAll}
      `,
      [UserData.Name, UserData.UserKey, UserData.Password],
    );

    expectSql(db.user.truncate().toSQL(), 'TRUNCATE "schema"."user"');

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
