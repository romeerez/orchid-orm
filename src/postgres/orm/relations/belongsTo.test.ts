import { db as db } from '../test-utils/test-db';
import { line, useTestDatabase } from '../test-utils/test-utils';
import { userFactory } from '../test-utils/user.factory';
import { profileFactory } from '../test-utils/profile.factory';

describe('belongsTo', () => {
  useTestDatabase();

  it('defines a method to query related record', async () => {
    const user = await userFactory.create();
    const profile = await profileFactory.create({ userId: user.id });

    const query = db.profile.user(profile);

    expect(query.toSql()).toBe(
      line(`
        SELECT "user".*
        FROM "user"
        WHERE "user"."id" = ${user.id}
        LIMIT 1
      `),
    );

    const result = await query;
    expect({
      ...result,
      updatedAt: result.updatedAt.getTime(),
      createdAt: result.updatedAt.getTime(),
    }).toEqual({
      ...user,
      updatedAt: result.updatedAt.getTime(),
      createdAt: result.updatedAt.getTime(),
    });
  });

  it('can be joined and selected', async () => {
    const query = db.profile.join('user');
    expect(query.toSql()).toBe(
      line(`
      SELECT "profile".* FROM "profile"
      JOIN "user" ON "profile"."userId" = "user"."id"
    `),
    );
  });
});
