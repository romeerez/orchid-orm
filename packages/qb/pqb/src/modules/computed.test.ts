import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';
import {
  Profile,
  profileData,
  userData as partialUserData,
} from '../test-utils/test-utils';
import { addComputedColumns } from './computed';

const User = addComputedColumns(
  testDb('user', (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    userKey: t.text().nullable(),
  })),
  {
    nameAndKey: (q) =>
      q.sql`"name" || ' ' || "userKey"`.type((t) => t.string()),
  },
);

const userData = { ...partialUserData, userKey: 'key' };
const nameAndKey = `${userData.name} ${userData.userKey}`;

describe('computed', () => {
  useTestDatabase();

  describe('select', () => {
    beforeAll(async () => {
      const userId = await User.get('id').insert(userData);
      await Profile.insert({ ...profileData, userId });
    });

    it('should select computed column', async () => {
      const q = User.select('name', 'nameAndKey').take();

      expectSql(
        q.toSQL(),
        `SELECT "user"."name", "name" || ' ' || "userKey" "nameAndKey"
          FROM "user"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { name: string; nameAndKey: string }>();

      expect(res).toEqual({ name: userData.name, nameAndKey });
    });

    it('should select computed column with dot', async () => {
      const q = User.select('name', 'user.nameAndKey').take();

      expectSql(
        q.toSQL(),
        `SELECT "user"."name", "name" || ' ' || "userKey" "nameAndKey"
          FROM "user"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { name: string; nameAndKey: string }>();

      expect(res).toEqual({ name: userData.name, nameAndKey });
    });

    it('should select computed column with alias', async () => {
      const q = User.select('name', { as: 'nameAndKey' }).take();

      expectSql(
        q.toSQL(),
        `SELECT "user"."name", "name" || ' ' || "userKey" AS "as"
          FROM "user"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { name: string; as: string }>();

      expect(res).toEqual({ name: userData.name, as: nameAndKey });
    });

    it('should select computed column with alias and dot', async () => {
      const q = User.select('name', { as: 'user.nameAndKey' }).take();

      expectSql(
        q.toSQL(),
        `SELECT "user"."name", "name" || ' ' || "userKey" AS "as"
          FROM "user"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { name: string; as: string }>();

      expect(res).toEqual({ name: userData.name, as: nameAndKey });
    });

    it('should select joined computed column', async () => {
      const q = Profile.join(User, 'id', 'userId')
        .select('user.nameAndKey')
        .take();

      expectSql(
        q.toSQL(),
        `SELECT "name" || ' ' || "userKey" "nameAndKey"
          FROM "profile"
          JOIN "user" ON "user"."id" = "profile"."userId"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { nameAndKey: string }>();

      expect(res).toEqual({ nameAndKey });
    });

    it('should select joined computed column with alias', async () => {
      const q = Profile.join(User, 'id', 'userId')
        .select({ as: 'user.nameAndKey' })
        .take();

      expectSql(
        q.toSQL(),
        `SELECT "name" || ' ' || "userKey" AS "as"
          FROM "profile"
          JOIN "user" ON "user"."id" = "profile"."userId"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { as: string }>();

      expect(res).toEqual({ as: nameAndKey });
    });
  });
});
