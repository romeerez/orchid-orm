import {
  BaseTable,
  db,
  profileData,
  sql,
  userData,
  useTestORM,
} from './test-utils/orm.test-utils';
import { orchidORMWithAdapter } from './orm';
import { pick } from 'orchid-core';
import { assertType } from 'test-utils';

describe('computed', () => {
  useTestORM();

  class UserTable extends BaseTable {
    readonly table = 'user';
    columns = this.setColumns((t) => ({
      Id: t.name('id').identity().primaryKey(),
      Name: t.name('name').text(),
      Password: t.name('password').text(),
      UserKey: t.name('user_key').text().nullable(),
    }));

    relations = {
      profile: this.hasOne(() => ProfileTable, {
        required: true,
        columns: ['Id', 'UserKey'],
        references: ['UserId', 'ProfileKey'],
      }),

      profiles: this.hasMany(() => ProfileTable, {
        required: true,
        columns: ['Id', 'UserKey'],
        references: ['UserId', 'ProfileKey'],
      }),
    };
  }

  class ProfileTable extends BaseTable {
    readonly table = 'profile';
    columns = this.setColumns((t) => ({
      Id: t.name('id').bigSerial().primaryKey(),
      Bio: t.name('bio').text(),
      ProfileKey: t.name('profile_key').text(),
      UserId: t.name('user_id').bigint().nullable(),
    }));

    computed = this.setComputed((q) => ({
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
    }));

    relations = {
      user: this.belongsTo(() => UserTable, {
        columns: ['UserId', 'ProfileKey'],
        references: ['Id', 'UserKey'],
      }),
    };
  }

  const local = orchidORMWithAdapter(
    { db: db.$qb },
    {
      user: UserTable,
      profile: ProfileTable,
    },
  );

  let profileId = '';
  beforeAll(async () => {
    const userId = String(
      await local.user
        .get('Id')
        .insert(pick(userData, ['Name', 'Password', 'UserKey'])),
    );

    profileId = String(
      await local.profile.get('Id').insert({
        ProfileKey: profileData.ProfileKey,
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
            sqlComputed: `bio ${userData.UserKey}`,
            sqlComputedDecimal: 1,
            depSql: `bio ${userData.UserKey}dep`,
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
          records:
            | {
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
              sqlComputed: `bio ${userData.UserKey}`,
              sqlComputedDecimal: 1,
              depSql: `bio ${userData.UserKey}dep`,
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
          sc: `bio ${userData.UserKey}`,
          scd: 1,
          ds: `bio ${userData.UserKey}dep`,
          rc: `${profileId} bio`,
          bc: `${profileId} bio`,
        },
      ]);
    });
  });
});
