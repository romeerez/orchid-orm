import { orchidORM } from './orm';
import { BaseTable, db, useTestORM } from './test-utils/test-utils';
import { assertType, expectSql } from 'test-utils';
import { Selectable } from './baseTable';

describe('orm', () => {
  useTestORM();

  type User = Selectable<UserTable>;
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
      const spy = jest.spyOn(db.$queryBuilder, 'query');

      await db.$query`SELECT 1`;

      expect(spy).toBeCalledWith`SELECT 1`;
    });

    it('should query arrays with the $queryArrays method', async () => {
      const spy = jest.spyOn(db.$queryBuilder, 'queryArrays');

      await db.$queryArrays`SELECT 1`;

      expect(spy).toBeCalledWith`SELECT 1`;
    });
  });
});
