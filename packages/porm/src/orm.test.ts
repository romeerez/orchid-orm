import { porm } from './orm';
import { ProfileModel, User, UserModel } from './test-utils/test-models';
import {
  AssertEqual,
  expectSql,
  insertUser,
  useTestDatabase,
} from './test-utils/test-utils';
import { adapter } from './test-utils/test-db';

describe('orm', () => {
  useTestDatabase();

  it('should return object with provided adapter, destroy and transaction method, models', () => {
    const db = porm(adapter)({
      user: UserModel,
      profile: ProfileModel,
    });

    expect(db.adapter).toBe(adapter);
    expect(db.destroy).toBeInstanceOf(Function);
    expect(db.transaction).toBeInstanceOf(Function);
    expect(Object.keys(db)).toEqual(
      expect.arrayContaining(['user', 'profile']),
    );
  });

  it('should return model which is queryable interface', async () => {
    await insertUser();

    const db = porm(adapter)({
      user: UserModel,
    });

    const query = db.user
      .select('id', 'name', 'active')
      .where({ id: { gt: 0 } });

    expectSql(
      query.toSql(),
      `
        SELECT "user"."id", "user"."name", "user"."active"
        FROM "user"
        WHERE "user"."id" > $1
      `,
      [0],
    );

    const result = await query;
    expect(result).toEqual([{ id: 1, name: 'name', active: true }]);

    const eq: AssertEqual<
      typeof result,
      Pick<User, 'id' | 'name' | 'active'>[]
    > = true;
    expect(eq).toBe(true);
  });
});
