import {
  BaseTable,
  db,
  profileData,
  sql,
  userData,
  useTestORM,
} from './test-utils/orm.test-utils';
import { orchidORM } from './orm';
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

    computed = this.setComputed((q) => ({
      sqlComputed: sql`${q.column('Name')} || ' ' || ${q.column(
        'UserKey',
      )}`.type((t) => t.text()),
      runtimeComputed: q.computeAtRuntime(
        ['Id', 'Name'],
        (record) => `${record.Id} ${record.Name}`,
      ),
      batchComputed: q.computeBatchAtRuntime(['Id', 'Name'], (records) =>
        Promise.all(records.map((record) => `${record.Id} ${record.Name}`)),
      ),
    }));

    relations = {
      profile: this.hasOne(() => ProfileTable, {
        required: true,
        columns: ['Id', 'UserKey'],
        references: ['UserId', 'ProfileKey'],
      }),
    };
  }

  class ProfileTable extends BaseTable {
    readonly table = 'profile';
    columns = this.setColumns((t) => ({
      Id: t.name('id').identity().primaryKey(),
      ProfileKey: t.name('profile_key').text(),
      UserId: t.name('user_id').integer().nullable(),
    }));

    relations = {
      user: this.belongsTo(() => UserTable, {
        columns: ['UserId', 'ProfileKey'],
        references: ['Id', 'UserKey'],
      }),
    };
  }

  const local = orchidORM(
    { db: db.$queryBuilder },
    {
      user: UserTable,
      profile: ProfileTable,
    },
  );

  let userId = 0;
  beforeAll(async () => {
    userId = await local.user
      .get('Id')
      .insert(pick(userData, ['Name', 'Password', 'UserKey']));

    await local.profile.insert({
      ProfileKey: profileData.ProfileKey,
      UserId: userId,
    });
  });

  describe('select', () => {
    it('should select record with computed', async () => {
      const q = local.profile.select({
        user: (q) =>
          q.user.select('sqlComputed', 'runtimeComputed', 'batchComputed'),
      });

      const res = await q;

      assertType<
        typeof res,
        {
          user:
            | {
                sqlComputed: string;
                runtimeComputed: string;
                batchComputed: string;
              }
            | undefined;
        }[]
      >();

      expect(res).toEqual([
        {
          user: {
            sqlComputed: `${userData.Name} ${userData.UserKey}`,
            runtimeComputed: `${userId} ${userData.Name}`,
            batchComputed: `${userId} ${userData.Name}`,
          },
        },
      ]);
    });

    it('should get computed fields of a relation', async () => {
      const res = await local.profile.select({
        sc: (q) => q.user.get('sqlComputed'),
        rc: (q) => q.user.get('runtimeComputed'),
        bc: (q) => q.user.get('batchComputed'),
      });

      assertType<
        typeof res,
        {
          sc: string;
          rc: string;
          bc: string;
        }[]
      >();

      expect(res).toEqual([
        {
          sc: `${userData.Name} ${userData.UserKey}`,
          rc: `${userId} ${userData.Name}`,
          bc: `${userId} ${userData.Name}`,
        },
      ]);
    });
  });
});
