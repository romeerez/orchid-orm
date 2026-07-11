import { AdapterClass, noop, TransactionAdapterClass } from 'pqb/internal';
import {
  db,
  line,
  ProfileData,
  ProfileSelectAll,
  UserData,
  UserSelectAll,
} from 'test-utils';

describe('transaction', () => {
  beforeEach(jest.clearAllMocks);
  afterAll(db.$close);

  it.each(['$transaction', '$ensureTransaction'] as const)(
    'should have override %s method which implicitly connects tables with a single transaction',
    async (method) => {
      const transactionSpy = jest.spyOn(AdapterClass.prototype, 'transaction');
      const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');

      expect(db.$isInTransaction()).toBe(false);

      await db[method](async () => {
        expect(db.$isInTransaction()).toBe(true);

        await db.user.create(UserData);
        await db.profile.create(ProfileData);
        throw new Error('Throw error to rollback');
      }).catch(noop);

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(querySpy.mock.calls.map((call) => call[0])).toEqual([
        line(`
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4, $5)
          RETURNING ${UserSelectAll}
        `),
        line(`
          INSERT INTO "schema"."profile" AS "Profile"("bio", "profile_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4)
          RETURNING ${ProfileSelectAll}
        `),
      ]);
    },
  );

  it('should delegate $afterCommit to the query builder', () => {
    const spy = jest.spyOn(db.$qb, 'afterCommit');

    db.$afterCommit(noop);

    expect(spy).toHaveBeenCalledWith(noop);
  });

  it('should accept and forward role and setConfig options', async () => {
    const qbTransactionSpy = jest
      .spyOn(db.$qb, 'transaction')
      .mockResolvedValue(undefined);

    await db.$transaction(
      {
        role: 'app_user',
        setConfig: {
          'app.tenant_id': 42,
          'app.enabled': true,
        },
      },
      async () => {},
    );

    expect(qbTransactionSpy).toHaveBeenCalledTimes(1);
    expect(qbTransactionSpy.mock.calls[0][0]).toEqual({
      role: 'app_user',
      setConfig: {
        'app.tenant_id': 42,
        'app.enabled': true,
      },
    });
  });
});
