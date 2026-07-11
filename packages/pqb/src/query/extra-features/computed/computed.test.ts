import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';
import {
  Profile,
  profileData,
  ProfileRecord,
  profileTableColumnsSql,
  userData as partialUserData,
} from '../../../test-utils/pqb.test-utils';
import { Query } from '../../query';
import { NotFoundError } from '../../errors';

const User = testDb(
  'User',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.text(),
    password: t.text(),
    userKey: t.text().nullable(),
    column: t.integer().nullable(),
    updatedAt: t.timestamp().default(sql`now()`),
  }),
  undefined,
  {
    schema: () => 'schema',
    computed: (q) => ({
      nameAndKey: q.sql(
        () => sql<string>`${q.column('name')} || ' ' || ${q.column('userKey')}`,
      ),
      decimal: sql`1::decimal`.type((t) => t.decimal().parse(parseFloat)),
      depSql() {
        return sql`${this.nameAndKey} || 'dep'`.type((t) => t.string());
      },
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

const userColumnsSql = User.q.selectAllColumns!.join(', ');

const userData = { ...partialUserData, userKey: 'key' };
const nameAndKey = `${userData.name} ${userData.userKey}`;
const depSql = `${nameAndKey}dep`;

const joinQuery = User.as('user').whereSql`"profile"."user_id" = "user"."id"`;

Object.assign(Profile.relations, {
  user: {
    query: joinQuery,
    joinQuery: () => joinQuery,
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
    it('should not be included into the table columns', () => {
      expect('nameAndKey' in User.q.selectAllShape).toBe(false);
      expect('decimal' in User.q.selectAllShape).toBe(false);
      expect('depSql' in User.q.selectAllShape).toBe(false);
    });

    it('should store SQL computed expression as selected-output SQL', () => {
      const column = User.q.selectShape.nameAndKey;

      expect(column.data.computed).toBeDefined();
      expect(column.data.selectSql).toBe(column.data.computed);
    });

    describe('select', () => {
      it('should select computed column', async () => {
        const q = User.select('name', 'nameAndKey', 'decimal', 'depSql').take();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "User"."name", ("User"."name" || ' ' || "User"."user_key") "nameAndKey",
              (1::decimal) "decimal",
              ("User"."name" || ' ' || "User"."user_key" || 'dep') "depSql"
            FROM "schema"."user" "User"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; nameAndKey: string; decimal: number; depSql: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          nameAndKey,
          decimal: 1,
          depSql,
        });
      });

      it('should select computed column with dot', async () => {
        const q = User.select(
          'name',
          'User.nameAndKey',
          'User.decimal',
          'User.depSql',
        ).take();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "User"."name",
              ("User"."name" || ' ' || "User"."user_key") "nameAndKey",
              (1::decimal) "decimal",
              ("User"."name" || ' ' || "User"."user_key" || 'dep') "depSql"
            FROM "schema"."user" "User"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; nameAndKey: string; decimal: number; depSql: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          nameAndKey,
          decimal: 1,
          depSql,
        });
      });

      it('should select computed column with alias', async () => {
        const q = User.select('name', {
          as: 'nameAndKey',
          dec: 'decimal',
          dep: 'depSql',
        }).take();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "User"."name",
              ("User"."name" || ' ' || "User"."user_key") "as",
              (1::decimal) "dec",
              ("User"."name" || ' ' || "User"."user_key" || 'dep') "dep"
            FROM "schema"."user" "User"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; as: string; dec: number; dep: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          as: nameAndKey,
          dec: 1,
          dep: depSql,
        });
      });

      it('should select computed column with alias and dot', async () => {
        const q = User.select('name', {
          as: 'User.nameAndKey',
          dec: 'User.decimal',
          dep: 'User.depSql',
        }).take();

        expectSql(
          q.toSQL(),
          `
            SELECT
              "User"."name",
              ("User"."name" || ' ' || "User"."user_key") "as",
              (1::decimal) "dec",
              ("User"."name" || ' ' || "User"."user_key" || 'dep') "dep"
            FROM "schema"."user" "User"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; as: string; dec: number; dep: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          as: nameAndKey,
          dec: 1,
          dep: depSql,
        });
      });

      it('should select joined computed column', async () => {
        const q = Profile.join(User, 'id', 'userId')
          .select('User.nameAndKey', 'User.decimal', 'User.depSql')
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT
              ("User"."name" || ' ' || "User"."user_key") "nameAndKey",
              (1::decimal) "decimal",
              ("User"."name" || ' ' || "User"."user_key" || 'dep') "depSql"
            FROM "schema"."profile" "Profile"
            JOIN "schema"."user" "User" ON "User"."id" = "Profile"."user_id"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          { nameAndKey: string; decimal: number; depSql: string }
        >();

        expect(res).toEqual({ nameAndKey, decimal: 1, depSql });
      });

      it('should select joined computed column with alias', async () => {
        const q = Profile.join(User, 'id', 'userId')
          .select({
            as: 'User.nameAndKey',
            dec: 'User.decimal',
            dep: 'User.depSql',
          })
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT
              ("User"."name" || ' ' || "User"."user_key") "as",
              (1::decimal) "dec",
              ("User"."name" || ' ' || "User"."user_key" || 'dep') "dep"
            FROM "schema"."profile" "Profile"
            JOIN "schema"."user" "User" ON "User"."id" = "Profile"."user_id"
            LIMIT 1
          `,
        );

        const res = await q;

        assertType<typeof res, { as: string; dec: number; dep: string }>();

        expect(res).toEqual({ as: nameAndKey, dec: 1, dep: depSql });
      });
    });

    describe('where', () => {
      it('should support computed columns', () => {
        const q = User.where({
          nameAndKey: 'value',
          decimal: 1,
          depSql: 'dep',
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${userColumnsSql} FROM "schema"."user" "User"
            WHERE
              ("User"."name" || ' ' || "User"."user_key") = $1 AND
              (1::decimal) = $2 AND
              ("User"."name" || ' ' || "User"."user_key" || 'dep') = $3
          `,
          ['value', 1, 'dep'],
        );
      });

      it('should support where operators', () => {
        const q = User.where({
          decimal: { gt: 0 },
          depSql: { endsWith: 'dep' },
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${userColumnsSql} FROM "schema"."user" "User"
            WHERE (1::decimal) > $1
              AND ("User"."name" || ' ' || "User"."user_key" || 'dep') ILIKE '%' || $2
          `,
          [0, 'dep'],
        );
      });

      it('should support where operators with dot', () => {
        const q = User.where({
          'User.decimal': { gt: 0 },
          'User.depSql': { endsWith: 'dep' },
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${userColumnsSql} FROM "schema"."user" "User"
            WHERE (1::decimal) > $1
              AND ("User"."name" || ' ' || "User"."user_key" || 'dep') ILIKE '%' || $2
          `,
          [0, 'dep'],
        );
      });
    });

    describe('order', () => {
      it('should support computed column', () => {
        const q = User.order('nameAndKey', 'decimal', 'depSql');

        expectSql(
          q.toSQL(),
          `
            SELECT ${userColumnsSql} FROM "schema"."user" "User"
            ORDER BY
              ("User"."name" || ' ' || "User"."user_key") ASC,
              (1::decimal) ASC,
              ("User"."name" || ' ' || "User"."user_key" || 'dep') ASC
          `,
        );
      });

      it('should support computed column for object', () => {
        const q = User.order({
          nameAndKey: 'DESC',
          decimal: 'DESC',
          depSql: 'DESC',
        });

        expectSql(
          q.toSQL(),
          `
            SELECT ${userColumnsSql} FROM "schema"."user" "User"
            ORDER BY
              ("User"."name" || ' ' || "User"."user_key") DESC,
              (1::decimal) DESC,
              ("User"."name" || ' ' || "User"."user_key" || 'dep') DESC
          `,
        );
      });
    });

    describe('create', () => {
      it('should not allow computed columns', () => {
        expect(() =>
          // @ts-expect-error computed column should not be allowed
          User.insert({
            ...partialUserData,
            nameAndKey: 'value',
          }),
        ).toThrow('Trying to insert a readonly column');
      });
    });

    describe('update', () => {
      it('should not allow computed columns', () => {
        expect(() =>
          User.find(1).update({
            name: 'name',
            // @ts-expect-error computed column should not be allowed
            nameAndKey: 'value',
          }),
        ).toThrow('Trying to update a readonly column');
      });
    });
  });

  describe('runtime computed', () => {
    it('should not mutate the query', () => {
      const q1 = User.select('runtimeComputed');
      const q2 = q1.select('batchComputed');

      expect(Object.keys(q1.q.selectedComputeds || {}).length).toBe(1);
      expect(Object.keys(q2.q.selectedComputeds || {}).length).toBe(2);
    });

    describe('select', () => {
      it.each(['runtimeComputed', 'batchComputed'] as const)(
        '%s should be supported in `get`',
        async (column) => {
          const q = User.get(column);

          expectSql(
            q.toSQL(),
            `SELECT "User"."id", "User"."name" FROM "schema"."user" "User" LIMIT 1`,
          );

          const res = await q;

          assertType<typeof res, string>();

          expect(res).toBe(`${userId} name`);
        },
      );

      it.each(['runtimeComputed', 'batchComputed'] as const)(
        '%s should be supported in `pluck`',
        async (column) => {
          const q = User.pluck(column);

          expectSql(
            q.toSQL(),
            `SELECT "User"."id", "User"."name" FROM "schema"."user" "User"`,
          );

          const res = await q;

          assertType<typeof res, string[]>();

          expect(res).toEqual([`${userId} name`]);
        },
      );

      it.each(['runtimeComputed', 'batchComputed'] as const)(
        '%s should be supported in `rows`',
        async (column) => {
          const q = User.select(column).rows();

          expectSql(
            q.toSQL(),
            `SELECT "User"."id", "User"."name" FROM "schema"."user" "User"`,
          );

          const res = await q;

          assertType<typeof res, string[][]>();

          expect(res).toEqual([[`${userId} name`]]);
        },
      );

      it.each(['runtimeComputed', 'batchComputed'] as const)(
        '%s should select computed column and its dependency under aliases',
        async (column) => {
          const q = User.select({
            n: 'name',
            b: column,
          });

          expectSql(
            q.toSQL(),
            `SELECT "User"."name" "n", "User"."id" FROM "schema"."user" "User"`,
          );

          const result = await q;
          expect(result).toEqual([{ n: 'name', b: `${userId} name` }]);
        },
      );

      it('should select computed column', async () => {
        const q = User.select('name', 'password', 'runtimeComputed').take();

        expectSql(
          q.toSQL(),
          `SELECT "User"."name", "User"."password", "User"."id" FROM "schema"."user" "User" LIMIT 1`,
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
          `SELECT "User"."name", "User"."password", "User"."id" FROM "schema"."user" "User" LIMIT 1`,
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
          'User.runtimeComputed',
        ).take();

        expectSql(
          q.toSQL(),
          `SELECT "User"."name", "User"."password", "User"."id" FROM "schema"."user" "User" LIMIT 1`,
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
          `SELECT "User"."name", "User"."password", "User"."id" FROM "schema"."user" "User" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; as: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          as: `${userId} ${userData.name}`,
        });
      });

      it('should select computed column with alias and dot', async () => {
        const q = User.select('name', 'password', {
          as: 'User.runtimeComputed',
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT "User"."name", "User"."password", "User"."id" FROM "schema"."user" "User" LIMIT 1`,
        );

        const res = await q;

        assertType<
          typeof res,
          { name: string; password: string; as: string }
        >();

        expect(res).toEqual({
          name: userData.name,
          password: userData.password,
          as: `${userId} ${userData.name}`,
        });
      });

      it('should select with alias when there is a conflicting select', async () => {
        const q = User.select('runtimeComputed', {
          id: () => sql<boolean>`true`,
        }).take();

        expectSql(
          q.toSQL(),
          `SELECT true "id", "User"."id" "id2", "User"."name" FROM "schema"."user" "User" LIMIT 1`,
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
          .select('id', 'User.name', 'User.password', 'User.runtimeComputed')
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT "Profile"."id", "User"."name", "User"."password", "User"."id" "id2"
            FROM "schema"."profile" "Profile"
            JOIN "schema"."user" "User" ON "User"."id" = "Profile"."user_id"
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
          .select('*', 'User.name', 'User.password', 'User.runtimeComputed')
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT ${profileTableColumnsSql}, "User"."name", "User"."password", "User"."id" "id2"
            FROM "schema"."profile" "Profile"
            JOIN "schema"."user" "User" ON "User"."id" = "Profile"."user_id"
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
          .select('User.name', { as: 'User.runtimeComputed' })
          .take();

        expectSql(
          q.toSQL(),
          `
            SELECT "User"."name", "User"."id"
            FROM "schema"."profile" "Profile"
            JOIN "schema"."user" "User" ON "User"."id" = "Profile"."user_id"
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
          .select('User.runtimeComputed', 'User.updatedAt');

        expectSql(
          q.toSQL(),
          `
            SELECT "User"."runtimeComputed", "User"."updatedAt"
            FROM "schema"."profile" "Profile"
            JOIN "schema"."user" ON ("profile"."user_id" = "user"."id")
          `,
        );
      });

      it('should select a computed from a joined sub-query', async () => {
        const q = Profile.join(
          User.select('id', 'runtimeComputed', 'updatedAt'),
          'id',
          'userId',
        ).select('User.runtimeComputed', 'User.updatedAt');

        expectSql(
          q.toSQL(),
          `
            SELECT "User"."updatedAt", "User"."id", "User"."name"
            FROM "schema"."profile" "Profile"
            JOIN (
              SELECT "User"."id", "User"."updated_at" "updatedAt", "User"."name"
              FROM "schema"."user" "User"
            ) "User" ON "User"."id" = "Profile"."user_id"
          `,
        );

        const res = await q;

        assertType<
          typeof res,
          { runtimeComputed: string; updatedAt: Date }[]
        >();

        expect(res).toEqual([
          {
            runtimeComputed: `${userId} ${userData.name}`,
            updatedAt: expect.any(Date),
          },
        ]);
      });

      it('should select a computed from a lateral join', async () => {
        const q = Profile.joinLateral(
          User.select('id', 'runtimeComputed'),
          (q) => q.on('User.id', 'Profile.userId'),
        ).select('User.id', 'User.runtimeComputed');

        expectSql(
          q.toSQL(),
          `
            SELECT "User"."id", "User"."name"
            FROM "schema"."profile" "Profile"
            JOIN LATERAL (
              SELECT "User"."id", "User"."name"
              FROM "schema"."user" "User"
              WHERE "User"."id" = "Profile"."user_id"
            ) "User" ON true
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
              SELECT "User"."id", "User"."name"
              FROM "schema"."user" "User"
            )
            SELECT "u"."id", "u"."name" FROM "u"
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
              SELECT "User"."id", "User"."name"
              FROM "schema"."user" "User"
            )
            SELECT "u"."id", "u"."name"
            FROM "schema"."profile" "Profile"
            JOIN "u" ON "u"."id" = "Profile"."user_id"
          `,
        );

        const res = await q;

        assertType<typeof res, { runtimeComputed: string }[]>();

        expect(res).toEqual([
          { runtimeComputed: `${userId} ${userData.name}` },
        ]);
      });
    });

    describe('sub-select', () => {
      it('should select many', async () => {
        const res = await User.select({
          users: () =>
            User.select({
              users: () => User.select('runtimeComputed', 'batchComputed'),
            }),
        });

        assertType<
          typeof res,
          {
            users: {
              users: { runtimeComputed: string; batchComputed: string }[];
            }[];
          }[]
        >();

        expect(res).toEqual([
          {
            users: [
              {
                users: [
                  {
                    runtimeComputed: `${userId} ${userData.name}`,
                    batchComputed: `${userId} ${userData.name}`,
                  },
                ],
              },
            ],
          },
        ]);
      });

      it('should select one optional', async () => {
        const res = await User.select({
          user: () =>
            User.select({
              user: () =>
                User.select('runtimeComputed', 'batchComputed').takeOptional(),
            }).takeOptional(),
        }).takeOptional();

        assertType<
          typeof res,
          | {
              user:
                | {
                    user:
                      | { runtimeComputed: string; batchComputed: string }
                      | undefined;
                  }
                | undefined;
            }
          | undefined
        >();

        expect(res).toEqual({
          user: {
            user: {
              runtimeComputed: `${userId} ${userData.name}`,
              batchComputed: `${userId} ${userData.name}`,
            },
          },
        });
      });

      it('should return undefined when one optional is not found', async () => {
        const res = await User.select({
          user: () =>
            User.select({
              user: () =>
                User.select('runtimeComputed', 'batchComputed').findOptional(0),
            }).takeOptional(),
        }).takeOptional();

        assertType<
          typeof res,
          | {
              user:
                | {
                    user:
                      | {
                          runtimeComputed: string;
                          batchComputed: string;
                        }
                      | undefined;
                  }
                | undefined;
            }
          | undefined
        >();

        expect(res).toEqual({
          user: { user: undefined },
        });
      });

      it('should select one required', async () => {
        const res = await User.select({
          user: () =>
            User.select({
              user: () =>
                User.select('runtimeComputed', 'batchComputed').take(),
            }).take(),
        }).take();

        assertType<
          typeof res,
          {
            user: {
              user: { runtimeComputed: string; batchComputed: string };
            };
          }
        >();

        expect(res).toEqual({
          user: {
            user: {
              runtimeComputed: `${userId} ${userData.name}`,
              batchComputed: `${userId} ${userData.name}`,
            },
          },
        });
      });

      it('should throw if one is not found', async () => {
        const q = User.select({
          user: () =>
            User.select({
              user: () =>
                User.select('runtimeComputed', 'batchComputed').find(0),
            }).take(),
        }).take();

        await expect(q).rejects.toThrow(NotFoundError);
      });

      it('should select a pluck', async () => {
        const id = await User.get('id').insert(userData);

        const res = await User.select({
          users: () =>
            User.select({
              runtimeComputed: () => User.order('id').pluck('runtimeComputed'),
              batchComputed: () => User.order('id').pluck('batchComputed'),
            }),
        });

        const expected = {
          runtimeComputed: [
            `${userId} ${userData.name}`,
            `${id} ${userData.name}`,
          ],
          batchComputed: [
            `${userId} ${userData.name}`,
            `${id} ${userData.name}`,
          ],
        };

        expect(res).toEqual([
          {
            users: [expected, expected],
          },
          {
            users: [expected, expected],
          },
        ]);
      });

      it('should select an optional value', async () => {
        const res = await User.select({
          user: () =>
            User.select({
              runtimeComputed: () => User.getOptional('runtimeComputed'),
              batchComputed: () => User.getOptional('batchComputed'),
            }).take(),
        }).take();

        assertType<
          typeof res,
          {
            user: {
              runtimeComputed: string | undefined;
              batchComputed: string | undefined;
            };
          }
        >();

        expect(res).toEqual({
          user: {
            runtimeComputed: `${userId} ${userData.name}`,
            batchComputed: `${userId} ${userData.name}`,
          },
        });
      });

      it('should select undefined for optional value when is not found', async () => {
        const res = await User.select({
          user: () =>
            User.select({
              runtimeComputed: () =>
                User.find(0).getOptional('runtimeComputed'),
              batchComputed: () => User.find(0).getOptional('batchComputed'),
            }).take(),
        }).take();

        expect(res).toEqual({
          user: {
            runtimeComputed: undefined,
            batchComputed: undefined,
          },
        });
      });

      it('should select a required value', async () => {
        const res = await User.select({
          user: () =>
            User.select({
              runtimeComputed: () => User.get('runtimeComputed'),
              batchComputed: () => User.get('batchComputed'),
            }).take(),
        }).take();

        assertType<
          typeof res,
          { user: { runtimeComputed: string; batchComputed: string } }
        >();

        expect(res).toEqual({
          user: {
            runtimeComputed: `${userId} ${userData.name}`,
            batchComputed: `${userId} ${userData.name}`,
          },
        });
      });

      it('should throw when a required value is not found', async () => {
        const q = User.select({
          user: () =>
            User.select({
              runtimeComputed: () => User.find(0).get('runtimeComputed'),
              batchComputed: () => User.find(0).get('batchComputed'),
            }).take(),
        }).take();

        await expect(q).rejects.toThrow(NotFoundError);
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
        Profile.join(User, 'userId', 'User.id').order('User.runtimeComputed');
      });
    });

    describe('create', () => {
      it('should not accept computed columns, but support them in returning', async () => {
        // @ts-expect-error computed column should not be allowed
        const q = User.select('id', 'runtimeComputed').insert({
          ...partialUserData,
          runtimeComputed: 'value',
        });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "password")
            VALUES ($1, $2)
            RETURNING "User"."id", "User"."name"
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
            UPDATE "schema"."user" "User"
            SET "name" = $1
            WHERE "User"."id" = $2
            RETURNING "User"."id", "User"."name"
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
            UPDATE "schema"."user" "User"
            SET "name" = $1
            WHERE "User"."id" = $2
            RETURNING "User"."id", "User"."name"
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
