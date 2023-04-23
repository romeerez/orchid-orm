import { OrchidORM, orchidORM } from './orm';
import { BaseTable } from './test-utils/test-utils';
import {
  assertType,
  expectSql,
  testDbOptions,
  useTestDatabase,
} from 'test-utils';

describe('orm', () => {
  useTestDatabase();

  let local:
    | OrchidORM<{ user: typeof UserTable; profile: typeof ProfileTable }>
    | undefined;

  afterEach(async () => {
    if (local) await local.$close();
  });

  type User = UserTable['columns']['type'];
  class UserTable extends BaseTable {
    readonly table = 'user';
    filePath = 'orm.test.ts';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
      name: t.text(1, 10),
      password: t.text(1, 10),
    }));
  }

  class ProfileTable extends BaseTable {
    readonly table = 'profile';
    filePath = 'orm.test.ts';
    columns = this.setColumns((t) => ({
      id: t.identity().primaryKey(),
    }));
  }

  it('should return object with provided adapter, close and transaction method, tables', () => {
    local = orchidORM(testDbOptions, {
      user: UserTable,
      profile: ProfileTable,
    });

    expect('$adapter' in local).toBe(true);
    expect(local.$close).toBeInstanceOf(Function);
    expect(local.$transaction).toBeInstanceOf(Function);
    expect(Object.keys(local)).toEqual(
      expect.arrayContaining(['user', 'profile']),
    );
  });

  it('should return table which is a queryable interface', async () => {
    local = orchidORM(testDbOptions, {
      user: UserTable,
      profile: ProfileTable,
    });

    const { id, name } = await local.user.create({
      name: 'name',
      password: 'password',
    });

    const query = local.user.select('id', 'name').where({ id: { gt: 0 } });

    expectSql(
      query.toSql(),
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
    local = orchidORM(
      { ...testDbOptions, autoPreparedStatements: true },
      {
        user: UserTable,
        profile: ProfileTable,
      },
    );

    expect(local.user.query.autoPreparedStatements).toBe(true);
  });
});
