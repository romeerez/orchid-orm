import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';
import {
  Profile,
  profileData,
  ProfileRecord,
  userData as partialUserData,
} from '../test-utils/test-utils';
import { Query } from '../query/query';

const User = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    userKey: t.text().nullable(),
  }),
  undefined,
  {
    computed: (q) => ({
      nameAndKey: q.sql`${q.column('name')} || ' ' || ${q.column(
        'userKey',
      )}`.type((t) => t.string()),
      runtimeComputed: q.computeAtRuntime(
        ['id', 'name'],
        (record) => `${record.id} ${record.name}`,
      ),
      batchComputed: q.computeBatchAtRuntime(['id', 'name'], (records) =>
        Promise.all(records.map((record) => `${record.id} ${record.name}`)),
      ),
    }),
  },
);

const userData = { ...partialUserData, userKey: 'key' };
const nameAndKey = `${userData.name} ${userData.userKey}`;

const joinQuery = User.as('user').whereSql`"profile"."userId" = "user"."id"`;

Object.assign(Profile.relations, {
  user: {
    relationConfig: {
      query: joinQuery,
      joinQuery: () => joinQuery,
    },
  },
});

describe('computed', () => {
  useTestDatabase();

  let userId = 0;
  let profile = {} as ProfileRecord;
  beforeAll(async () => {
    userId = await User.get('id').insert(userData);
    profile = await Profile.create({ ...profileData, userId });
  });

  describe('sql computed', () => {
    describe('select', () => {
      it('should select computed column', async () => {
        const q = User.select('name', 'nameAndKey').take();

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" "nameAndKey"
            FROM "user"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<typeof res, { name: string; nameAndKey: string }>();

        expect(res).toEqual({ name: userData.name, nameAndKey });
      });

      it('should select computed column with dot', async () => {
        const q = User.select('name', 'user.nameAndKey').take();

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" "nameAndKey"
            FROM "user"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<typeof res, { name: string; nameAndKey: string }>();

        expect(res).toEqual({ name: userData.name, nameAndKey });
      });

      it('should select computed column with alias', async () => {
        const q = User.select('name', { as: 'nameAndKey' }).take();

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" "as"
            FROM "user"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<typeof res, { name: string; as: string }>();

        expect(res).toEqual({ name: userData.name, as: nameAndKey });
      });

      it('should select computed column with alias and dot', async () => {
        const q = User.select('name', { as: 'user.nameAndKey' }).take();

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."name", "user"."name" || ' ' || "user"."userKey" "as"
            FROM "user"
            LIMIT 1
          `,
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
          `
            SELECT "user"."name" || ' ' || "user"."userKey" "nameAndKey"
            FROM "profile"
            JOIN "user" ON "user"."id" = "profile"."userId"
            LIMIT 1
          `,
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
          `
            SELECT "user"."name" || ' ' || "user"."userKey" "as"
            FROM "profile"
            JOIN "user" ON "user"."id" = "profile"."userId"
            LIMIT 1
          `,
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
          `
            SELECT * FROM "user"
            WHERE "user"."name" || ' ' || "user"."userKey" = $1
          `,
          ['value'],
        );
      });

      it('should support where operators', () => {
        const q = User.where({ nameAndKey: { startsWith: 'value' } });

        expectSql(
          q.toSQL(),
          `
            SELECT * FROM "user"
            WHERE "user"."name" || ' ' || "user"."userKey" ILIKE $1 || '%'
          `,
          ['value'],
        );
      });

      it('should support where operators with dot', () => {
        const q = User.where({ 'user.nameAndKey': { startsWith: 'value' } });

        expectSql(
          q.toSQL(),
          `
            SELECT * FROM "user"
            WHERE "user"."name" || ' ' || "user"."userKey" ILIKE $1 || '%'
          `,
          ['value'],
        );
      });
    });

    describe('order', () => {
      it('should support computed column', () => {
        const q = User.order('nameAndKey');

        expectSql(
          q.toSQL(),
          `
            SELECT * FROM "user"
            ORDER BY "user"."name" || ' ' || "user"."userKey" ASC
          `,
        );
      });

      it('should support computed column for object', () => {
        const q = User.order({ nameAndKey: 'DESC' });

        expectSql(
          q.toSQL(),
          `
            SELECT * FROM "user"
            ORDER BY "user"."name" || ' ' || "user"."userKey" DESC
          `,
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

  describe('runtime computed', () => {
    describe('select', () => {
      it('should select computed column', async () => {
        const q = User.select('name', 'password', 'runtimeComputed').take();

        expectSql(
          q.toSQL(),
          `SELECT "user"."name", "user"."password", "user"."id" FROM "user" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; runtimeComputed: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select computed column in batch', async () => {
        const q = User.select('name', 'password', 'batchComputed').take();

        expectSql(
          q.toSQL(),
          `SELECT "user"."name", "user"."password", "user"."id" FROM "user" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; batchComputed: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          batchComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select computed column with dot', async () => {
        const q = User.select(
          'name',
          'password',
          'user.runtimeComputed',
        ).take();

        expectSql(
          q.toSQL(),
          `SELECT "user"."name", "user"."password", "user"."id" FROM "user" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; runtimeComputed: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select computed column with alias', async () => {
        const q = User.select('name', 'password', {
          as: 'runtimeComputed',
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT "user"."name", "user"."password", "user"."id" FROM "user" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; as: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select computed column with alias and dot', async () => {
        const q = User.select('name', 'password', {
          as: 'user.runtimeComputed',
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT "user"."name", "user"."password", "user"."id" FROM "user" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; as: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select with alias when there is a conflicting select', async () => {
        const q = User.select('runtimeComputed', {
          id: (q) => q.sql<boolean>`true`,
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT true "id", "user"."id" "id2", "user"."name" FROM "user" LIMIT 1`,
        );

        const res = await q;

        assertType<typeof res, { id: boolean; runtimeComputed: string }>();

        expect(res).toEqual({
          id: true,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select joined computed column', async () => {
        const q = Profile.join(User, 'id', 'userId')
          .select('id', 'user.name', 'user.password', 'user.runtimeComputed')
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT "profile"."id", "user"."name", "user"."password", "user"."id" "id2"
            FROM "profile"
            JOIN "user" ON "user"."id" = "profile"."userId"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          {
            id: number;
            name: string;
            password: string;
            runtimeComputed: string;
          }
        >();

        expect(res).toEqual({
          id: profile.id,
          name: userData.name,
          password: userData.password,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select joined computed column when selecting all from the main table', async () => {
        const q = Profile.join(User, 'id', 'userId')
          .select('*', 'user.name', 'user.password', 'user.runtimeComputed')
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT "profile".*, "user"."name", "user"."password", "user"."id" "id2"
            FROM "profile"
            JOIN "user" ON "user"."id" = "profile"."userId"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          ProfileRecord & {
            name: string;
            password: string;
            runtimeComputed: string;
          }
        >();

        expect(res).toEqual({
          ...profile,
          name: userData.name,
          password: userData.password,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select joined computed column with alias', async () => {
        const q = Profile.join(User, 'id', 'userId')
          .select('user.name', { as: 'user.runtimeComputed' })
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."name", "user"."id"
            FROM "profile"
            JOIN "user" ON "user"."id" = "profile"."userId"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<typeof res, { name: string; as: string }>();

        expect(res).toEqual({
          name: userData.name,
          runtimeComputed: `${userId} ${userData.name}`,
        });
      });

      it('should select a computed column from a joined relation', async () => {
        const q = (Profile as Query)
          .join('user')
          .select('user.runtimeComputed');

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."id", "user"."name"
            FROM "profile"
            JOIN "user" ON ("profile"."userId" = "user"."id")
          `,
        );

        const res = await q;
        expect(res).toEqual([
          { runtimeComputed: `${userId} ${userData.name}` },
        ]);
      });

      it('should select a computed from a joined sub-query', async () => {
        const q = Profile.join(
          User.select('id', 'runtimeComputed'),
          'id',
          'userId',
        ).select('user.runtimeComputed');

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."id", "user"."name"
            FROM "profile"
            JOIN (
              SELECT "user"."id", "user"."name"
              FROM "user"
            ) "user" ON "user"."id" = "profile"."userId"
          `,
        );

        const res = await q;

        assertType<typeof res, { runtimeComputed: string }[]>();

        expect(res).toEqual([
          { runtimeComputed: `${userId} ${userData.name}` },
        ]);
      });

      it('should select a computed from a lateral join', async () => {
        const q = Profile.joinLateral(
          User.select('id', 'runtimeComputed'),
          (q) => q.on('user.id', 'profile.userId'),
        ).select('user.id', 'user.runtimeComputed');

        expectSql(
          q.toSQL(),
          `
            SELECT "user"."id", "user"."name"
            FROM "profile"
            JOIN LATERAL (
              SELECT "user"."id", "user"."name"
              FROM "user"
              WHERE "user"."id" = "profile"."userId"
            ) "user" ON true
          `,
        );

        const res = await q;
        expect(res).toEqual([
          { id: userId, runtimeComputed: `${userId} ${userData.name}` },
        ]);
      });

      it('should select a computed column from a with statement', async () => {
        const q = testDb
          .with('u', () => User.select('runtimeComputed'))
          .from('u')
          .select('runtimeComputed');

        expectSql(
          q.toSQL(),
          `
            WITH "u" AS (
              SELECT "user"."id", "user"."name"
              FROM "user"
            )
            SELECT "id", "name" FROM "u"
          `,
        );

        const res = await q;

        assertType<typeof res, { runtimeComputed: string }[]>();

        expect(res).toEqual([
          { runtimeComputed: `${userId} ${userData.name}` },
        ]);
      });

      it('should select a computed column from a joined with statement', async () => {
        const q = Profile.with('u', () => User.select('id', 'runtimeComputed'))
          .join('u', 'id', 'userId')
          .select('u.runtimeComputed');

        expectSql(
          q.toSQL(),
          `
            WITH "u" AS (
              SELECT "user"."id", "user"."name"
              FROM "user"
            )
            SELECT "u"."id", "u"."name"
            FROM "profile"
            JOIN "u" ON "u"."id" = "profile"."userId"
          `,
        );

        const res = await q;

        assertType<typeof res, { runtimeComputed: string }[]>();

        expect(res).toEqual([
          { runtimeComputed: `${userId} ${userData.name}` },
        ]);
      });
    });

    describe('where', () => {
      it('should not support computed columns', () => {
        // @ts-expect-error computed column should not be allowed
        User.where({ runtimeComputed: 'value' });
      });
    });

    describe('order', () => {
      it('should not support computed column', () => {
        // @ts-expect-error computed column should not be allowed
        User.order('runtimeComputed');
      });

      it('should not support joined computed column', () => {
        // @ts-expect-error computed column should not be allowed
        Profile.join(User, 'userId', 'user.id').order('user.runtimeComputed');
      });
    });

    describe('create', () => {
      it('should not accept computed columns, but support them in returning', async () => {
        const q = User.select('id', 'runtimeComputed').insert({
          ...partialUserData,
          // @ts-expect-error computed column should not be allowed
          runtimeComputed: 'value',
        });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            RETURNING "user"."id", "user"."name"
          `,
          [userData.name, userData.password],
        );

        const res = await q;

        assertType<typeof res, { id: number; runtimeComputed: string }>();

        expect(res).toEqual({
          id: res.id,
          runtimeComputed: `${res.id} ${userData.name}`,
        });
      });
    });

    describe('update', () => {
      it('should not accept computed columns, but support them in returning', async () => {
        const q = User.find(userId).select('runtimeComputed').update({
          name: 'new name',
          // @ts-expect-error computed column should not be allowed
          runtimeComputed: 'value',
        });

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET "name" = $1
            WHERE "user"."id" = $2
            RETURNING "user"."id", "user"."name"
          `,
          ['new name', userId],
        );

        const res = await q;

        assertType<typeof res, { runtimeComputed: string }>();

        expect(res).toEqual({ runtimeComputed: `${userId} new name` });
      });
    });

    describe('upsert', () => {
      it('should select a computed column when updating', async () => {
        const q = User.find(userId)
          .select('runtimeComputed')
          .upsert({
            data: {
              name: 'new name',
            },
            create: userData,
          });

        expectSql(
          q.toSQL(),
          `
            UPDATE "user"
            SET "name" = $1
            WHERE "user"."id" = $2
            RETURNING "user"."id", "user"."name"
          `,
          ['new name', userId],
        );

        const res = await q;

        assertType<typeof res, { runtimeComputed: string }>();

        expect(res).toEqual({ runtimeComputed: `${userId} new name` });
      });

      it('should select a computed column when creating', async () => {
        const res = await User.find(userId + 1)
          .select('id', 'runtimeComputed')
          .upsert({
            data: {
              name: 'new name',
            },
            create: userData,
          });

        assertType<typeof res, { id: number; runtimeComputed: string }>();

        expect(res).toEqual({
          id: res.id,
          runtimeComputed: `${res.id} ${userData.name}`,
        });
      });
    });
  });
});
