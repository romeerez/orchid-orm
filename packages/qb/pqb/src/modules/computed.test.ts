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
      q.sql`${q.column('name')} || ' ' || ${q.column('userKey')}`.type((t) =>
        t.string(),
      ),
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
        `SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" "nameAndKey"
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
        `SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" "nameAndKey"
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
        `SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" AS "as"
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
        `SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" AS "as"
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
        `SELECT "user"."name" || ' ' || "user"."userKey" "nameAndKey"
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
        `SELECT "user"."name" || ' ' || "user"."userKey" AS "as"
          FROM "profile"
          JOIN "user" ON "user"."id" = "profile"."userId"
          LIMIT 1`,
      );

      const res = await q;

      assertType<typeof res, { as: string }>();

      expect(res).toEqual({ as: nameAndKey });
    });
  });

  describe('where', () => {
    it('should support computed columns', () => {
      const q = User.where({ nameAndKey: 'value' });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user"
        WHERE "user"."name" || ' ' || "user"."userKey" = $1`,
        ['value'],
      );
    });

    it('should support where operators', () => {
      const q = User.where({ nameAndKey: { startsWith: 'value' } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user"
        WHERE "user"."name" || ' ' || "user"."userKey" ILIKE $1 || '%'`,
        ['value'],
      );
    });

    it('should support where operators with dot', () => {
      const q = User.where({ 'user.nameAndKey': { startsWith: 'value' } });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user"
        WHERE "user"."name" || ' ' || "user"."userKey" ILIKE $1 || '%'`,
        ['value'],
      );
    });
  });

  describe('order', () => {
    it('should support computed column', () => {
      const q = User.order('nameAndKey');

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user"
        ORDER BY "user"."name" || ' ' || "user"."userKey" ASC`,
      );
    });

    it('should support computed column for object', () => {
      const q = User.order({ nameAndKey: 'DESC' });

      expectSql(
        q.toSQL(),
        `SELECT * FROM "user"
        ORDER BY "user"."name" || ' ' || "user"."userKey" DESC`,
      );
    });
  });

  describe('create', () => {
    it('should not allow computed columns', () => {
      const q = User.insert({
        ...partialUserData,
        // @ts-expect-error computed column should not be allowed
        nameAndKey: 'value',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
        `,
        [userData.name, userData.password],
      );
    });
  });

  describe('update', () => {
    it('should not allow computed columns', () => {
      const q = User.find(1).update({
        name: 'name',
        // @ts-expect-error computed column should not be allowed
        nameAndKey: 'value',
      });

      expectSql(
        q.toSQL(),
        `
          UPDATE "user"
          SET "name" = $1
          WHERE "user"."id" = $2
        `,
        ['name', 1],
      );
    });
  });
});
