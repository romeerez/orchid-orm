import { noop } from 'orchid-core';
import {
  db,
  line,
  ProfileData,
  TestAdapter,
  TestTransactionAdapter,
  UserData,
} from 'test-utils';
import { profileSelectAll, userSelectAll } from './test-utils/orm.test-utils';

describe('transaction', () => {
  beforeEach(jest.clearAllMocks);
  afterAll(db.$close);

  it.each(['$transaction', '$ensureTransaction'] as const)(
    'should have override %s method which implicitly connects tables with a single transaction',
    async (method) => {
      const transactionSpy = jest.spyOn(TestAdapter.prototype, 'transaction');
      const querySpy = jest.spyOn(TestTransactionAdapter.prototype, 'query');

      expect(db.$isInTransaction()).toBe(false);

      await db[method](async () => {
        expect(db.$isInTransaction()).toBe(true);

        await db.user.create(UserData);
        await db.profile.create(ProfileData);
        throw new Error('Throw error to rollback');
      }).catch(noop);

      expect(transactionSpy).toBeCalledTimes(1);
      expect(querySpy.mock.calls.map((call) => call[0])).toEqual([
        line(`
          INSERT INTO "user"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING ${userSelectAll}
        `),
        line(`
          INSERT INTO "profile"("bio", "profile_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4)
          RETURNING ${profileSelectAll}
        `),
      ]);
    },
  );

  it('should delegate $afterCommit to the query builder', () => {
    const spy = jest.spyOn(db.$qb, 'afterCommit');

    db.$afterCommit(noop);

    expect(spy).toHaveBeenCalledWith(noop);
  });
});
