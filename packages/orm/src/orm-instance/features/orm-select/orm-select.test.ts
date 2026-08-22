import { assertType, db, sql } from 'test-utils';
import { useTestORM } from '../../../test-utils/orm.test-utils';

describe('$select', () => {
  useTestORM();

  it('should select independent query and expression results', async () => {
    const result = await db.$select({
      userCount: () => db.user.count(),
      one: () => sql<number>`1::int`,
    });

    assertType<typeof result, { userCount: number; one: number }>();

    expect(result).toEqual({ userCount: 0, one: 1 });
  });

  it('should select a chained relation query', async () => {
    const result = await db.$select({
      profile: () => db.user.chain('profile'),
    });

    expect(result).toEqual({ profile: [] });
  });
});
