import { Client } from 'pg';
import { noop } from 'orchid-core';
import { line } from 'test-utils';
import {
  db,
  profileData,
  profileSelectAll,
  userData,
  userSelectAll,
} from './test-utils/orm.test-utils';

describe('transaction', () => {
  beforeEach(jest.clearAllMocks);
  afterAll(db.$close);

  it.each(['$transaction', '$ensureTransaction'] as const)(
    'should have override %s method which implicitly connects tables with a single transaction',
    async (method) => {
      const spy = jest.spyOn(Client.prototype, 'query');

      expect(db.$isInTransaction()).toBe(false);

      await db[method](async () => {
        expect(db.$isInTransaction()).toBe(true);

        await db.user.create(userData);
        await db.profile.create(profileData);
        throw new Error('Throw error to rollback');
      }).catch(noop);

      expect(
        spy.mock.calls.map(
          (call) => (call[0] as unknown as { text: string }).text,
        ),
      ).toEqual([
        'BEGIN',
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
        'ROLLBACK',
      ]);
    },
  );

  it('should delegate $afterCommit to the query builder', () => {
    const spy = jest.spyOn(db.$queryBuilder, 'afterCommit');

    db.$afterCommit(noop);

    expect(spy).toHaveBeenCalledWith(noop);
  });
});
