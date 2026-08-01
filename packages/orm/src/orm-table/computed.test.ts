import {
  assertType,
  expectSql,
  ProfileData,
  UserData,
  testOrchidORMWithAdapter,
} from 'test-utils';
import { useTestORM } from '../test-utils/orm.test-utils';
import { createTableFactory } from './table';
import { pick } from 'pqb/internal';

describe('computed', () => {
  useTestORM();

  const { defineTable, sql } = createTableFactory({ snakeCase: true });

  const UserTable = defineTable('user', { schema: 'schema' }, (t) => ({
    Id: t.name('id').identity().primaryKey(),
    Name: t.name('name').text(),
    Password: t.name('password').text(),
    UserKey: t.name('user_key').text().nullable(),
  })).relations((user) => ({
    profile: user('Id', 'UserKey')
      .hasOne(() => ProfileTable('UserId', 'ProfileKey'))
      .required(),
    profiles: user('Id', 'UserKey').hasMany(() =>
      ProfileTable('UserId', 'ProfileKey'),
    ),
  }));

  const ProfileTable = defineTable('profile', { schema: 'schema' }, (t) => ({
    Id: t.name('id').bigSerial().primaryKey(),
    Bio: t.name('bio').text(),
    ProfileKey: t.name('profile_key').text(),
    UserId: t.name('user_id').bigint().nullable(),
  }))
    .computed((q) => ({
      sqlComputed: sql<string>`${q.column('Bio')} || ' ' || ${q.column(
        'ProfileKey',
      )}`,
      sqlComputedDecimal: sql`1::decimal`.type((t) =>
        t.decimal().parse(parseFloat),
      ),
      depSql() {
        return sql`${this.sqlComputed} || 'dep'`.type((t) => t.string());
      },
      runtimeComputed: q.computeAtRuntime(
        ['Id', 'Bio'],
        (record) => `${record.Id} ${record.Bio}`,
      ),
      batchComputed: q.computeBatchAtRuntime(['Id', 'Bio'], (records) =>
        Promise.all(records.map((record) => `${record.Id} ${record.Bio}`)),
      ),
    }))
    .relations((profile) => ({
      user: profile('UserId', 'ProfileKey').belongsTo(() =>
        UserTable('Id', 'UserKey'),
      ),
    }));

  const local = testOrchidORMWithAdapter({
    user: UserTable,
    profile: ProfileTable,
  });

  let profileId = '';
  beforeAll(async () => {
    const userId = String(
      await local.user
        .get('Id')
        .insert(pick(UserData, ['Name', 'Password', 'UserKey'])),
    );

    profileId = String(
      await local.profile.get('Id').insert({
        ProfileKey: ProfileData.ProfileKey,
        UserId: userId,
        Bio: 'bio',
      }),
    );
  });

  describe('select', () => {
    it('should select record with computed', async () => {
      const q = local.user.select({
        record: (q) =>
          q.profile.select(
            'Id',
            'sqlComputed',
            'sqlComputedDecimal',
            'depSql',
            'runtimeComputed',
            'batchComputed',
          ),
      });

      expectSql(
        q.toSQL(),
        `
          SELECT CASE WHEN to_jsonb("record") IS NULL THEN NULL ELSE json_build_object('Id', "record"."Id"::text, 'sqlComputed', "record"."sqlComputed", 'sqlComputedDecimal', "record"."sqlComputedDecimal"::text, 'depSql', "record"."depSql", 'Bio', "record"."Bio") END "record"
          FROM "schema"."user"
          LEFT JOIN LATERAL (
            SELECT "profile"."id" "Id", ("profile"."bio" || ' ' || "profile"."profile_key") "sqlComputed", (1::decimal) "sqlComputedDecimal", ("profile"."bio" || ' ' || "profile"."profile_key" || 'dep') "depSql", "profile"."bio" "Bio"
            FROM "schema"."profile"
            WHERE "profile"."user_id" = "user"."id" AND "profile"."profile_key" = "user"."user_key"
          ) "record" ON true
        `,
      );

      const res = await q;

      assertType<
        typeof res,
        {
          record: {
            Id: string;
            sqlComputed: string;
            sqlComputedDecimal: number;
            depSql: string;
            runtimeComputed: string;
            batchComputed: string;
          };
        }[]
      >();

      expect(res).toEqual([
        {
          record: {
            Id: profileId,
            sqlComputed: `bio ${UserData.UserKey}`,
            sqlComputedDecimal: 1,
            depSql: `bio ${UserData.UserKey}dep`,
            runtimeComputed: `${profileId} bio`,
            batchComputed: `${profileId} bio`,
          },
        },
      ]);
    });

    it('should select multiple records with computed', async () => {
      const q = local.user.select({
        records: (q) =>
          q.profiles.select(
            'Id',
            'sqlComputed',
            'sqlComputedDecimal',
            'depSql',
            'runtimeComputed',
            'batchComputed',
          ),
      });

      const res = await q;

      assertType<
        typeof res,
        {
          records: {
            Id: string;
            sqlComputed: string;
            sqlComputedDecimal: number;
            depSql: string;
            runtimeComputed: string;
            batchComputed: string;
          }[];
        }[]
      >();

      expect(res).toEqual([
        {
          records: [
            {
              Id: profileId,
              sqlComputed: `bio ${UserData.UserKey}`,
              sqlComputedDecimal: 1,
              depSql: `bio ${UserData.UserKey}dep`,
              runtimeComputed: `${profileId} bio`,
              batchComputed: `${profileId} bio`,
            },
          ],
        },
      ]);
    });

    it('should get computed fields of a relation', async () => {
      const res = await local.user.select({
        sc: (q) => q.profile.get('sqlComputed'),
        scd: (q) => q.profile.get('sqlComputedDecimal'),
        ds: (q) => q.profile.get('depSql'),
        rc: (q) => q.profile.get('runtimeComputed'),
        bc: (q) => q.profile.get('batchComputed'),
      });

      assertType<
        typeof res,
        {
          sc: string;
          scd: number;
          ds: string;
          rc: string;
          bc: string;
        }[]
      >();

      expect(res).toEqual([
        {
          sc: `bio ${UserData.UserKey}`,
          scd: 1,
          ds: `bio ${UserData.UserKey}dep`,
          rc: `${profileId} bio`,
          bc: `${profileId} bio`,
        },
      ]);
    });
  });
});
