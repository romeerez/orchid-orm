import { assertType, db, sql } from 'test-utils';
import {
  useQueryCounter,
  useTestORM,
} from '../../../test-utils/orm.test-utils';

const { getQueriesCount, getQueriesSql } = useQueryCounter();

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

  it('should perform a db query when one select is unconditional', async () => {
    const cond = false;

    const result = await db.$select({
      profile: () => (cond ? db.user.chain('profile') : sql.val(null)),
      userCount: () => db.user.count(),
    });

    expect(getQueriesCount()).toBe(1);
    expect(getQueriesSql()).toEqual([
      'SELECT (SELECT count(*) FROM "schema"."user" "User") "userCount" LIMIT 1',
    ]);

    expect(result).toEqual({ profile: null, userCount: 0 });
  });

  it('should not perform a db query when all selects are sql.val(null)', async () => {
    const cond = false;

    const result = await db.$select({
      profile: () => (cond ? db.user.chain('profile') : sql.val(null)),
      userCount: () => (cond ? db.user.count() : sql.val(null)),
    });

    expect(getQueriesCount()).toBe(0);

    expect(result).toEqual({ profile: null, userCount: null });
  });
});
