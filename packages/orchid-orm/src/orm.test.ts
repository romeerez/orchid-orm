import { orchidORM } from './orm';
import {
  assertType,
  expectSql,
  userData,
  useTestDatabase,
} from './test-utils/test-utils';
import { pgConfig } from './test-utils/test-db';
import { createModel } from './model';
import { columnTypes } from 'pqb';

describe('orm', () => {
  useTestDatabase();

  const Model = createModel({ columnTypes });

  type User = UserModel['columns']['type'];
  class UserModel extends Model {
    table = 'user';
    columns = this.setColumns((t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));
  }

  class ProfileModel extends Model {
    table = 'profile';
    columns = this.setColumns((t) => ({
      id: t.serial().primaryKey(),
    }));
  }

  it('should return object with provided adapter, close and transaction method, models', () => {
    const db = orchidORM(pgConfig, {
      user: UserModel,
      profile: ProfileModel,
    });

    expect('$adapter' in db).toBe(true);
    expect(db.$close).toBeInstanceOf(Function);
    expect(db.$transaction).toBeInstanceOf(Function);
    expect(Object.keys(db)).toEqual(
      expect.arrayContaining(['user', 'profile']),
    );
  });

  it('should return model which is a queryable interface', async () => {
    const db = orchidORM(pgConfig, {
      user: UserModel,
      profile: ProfileModel,
    });

    const { id, name } = await db.user.create(userData);

    const query = db.user.select('id', 'name').where({ id: { gt: 0 } });

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
});
