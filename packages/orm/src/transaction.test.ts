import { Client } from 'pg';
import { noop } from 'orchid-core';
import { line } from 'test-utils';
import {
  db,
  profileData,
  profileSelectAll,
  userData,
  userSelectAll,
} from './test-utils/test-utils';

describe('transaction', () => {
  afterAll(db.$close);

  it('should have override transaction method which implicitly connects tables with a single transaction', async () => {
    const spy = jest.spyOn(Client.prototype, 'query');

    await db
      .$transaction(async () => {
        await db.user.create(userData);
        await db.profile.create(profileData);
        throw new Error('Throw error to rollback');
      })
      .catch(noop);

    expect(
      spy.mock.calls.map(
        (call) => (call[0] as unknown as { text: string }).text,
      ),
    ).toEqual([
      'BEGIN',
      line(`
        INSERT INTO "user"("name", "userKey", "password", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${userSelectAll}
      `),
      line(`
        INSERT INTO "profile"("bio", "profileKey", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4)
        RETURNING ${profileSelectAll}
      `),
      'ROLLBACK',
    ]);
  });
});
