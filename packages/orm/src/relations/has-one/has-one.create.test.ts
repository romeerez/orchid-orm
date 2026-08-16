import { Db, NotFoundError } from 'pqb';
import { omit } from 'pqb/internal';
import {
  useQueryCounter,
  useRelationCallback,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import {
  UserDefaultSelect,
  Profile,
  db,
  ProfileData,
  UserData,
} from 'test-utils';

describe('hasOne create', () => {
  useTestORM();

  const { resetQueriesCount, getQueriesCount } = useQueryCounter();

  const useMultiQueryNestedCreate = () => {
    beforeAll(() => {
      db.$qb.internal.nestedCreateBatchMax = 1;
    });

    afterAll(() => {
      db.$qb.internal.nestedCreateBatchMax = 100;
    });
  };

  const assert = {
    user({ user, Name }: { user: UserDefaultSelect; Name: string }) {
      expect(user).toEqual({
        ...omit(UserData, ['Password']),
        Id: user.Id,
        Name,
        Active: null,
        Age: null,
        Data: null,
        Picture: null,
        Balance: null,
      });
    },

    profile({
      profile,
      Bio,
      Active,
    }: {
      profile: Profile;
      Bio: string;
      Active?: boolean;
    }) {
      expect(profile).toMatchObject({
        ...ProfileData,
        Id: profile.Id,
        UserId: profile.UserId,
        updatedAt: profile.updatedAt,
        createdAt: profile.createdAt,
        Bio,
        Active: Active || null,
      });
    },

    activeProfile(params: { profile: Profile; Bio: string }) {
      return this.profile({ ...params, Active: true });
    },
  };

  describe('create', () => {
    it('should restrict the type', () => {
      db.user.create({
        ...UserData,
        profile: {
          // @ts-expect-error the type is restricted
          create: 123,
        },
      });
    });

    it('should support create', async () => {
      const q = db.user.create({
        ...UserData,
        Name: 'user',
        profile: {
          create: {
            ...ProfileData,
            Bio: 'profile',
          },
        },
      });

      const user = await q;

      expect(getQueriesCount()).toEqual(1);

      const profile = await db.profile.findBy({ UserId: user.Id });

      assert.user({ user, Name: 'user' });
      assert.profile({ profile, Bio: 'profile' });
    });

    it('should support create using `on`', async () => {
      const q = db.user.create({
        ...UserData,
        Name: 'user',
        activeProfile: {
          create: {
            ...ProfileData,
            Bio: 'profile',
          },
        },
      });

      const user = await q;

      expect(getQueriesCount()).toEqual(1);

      const profile = await db.profile.findBy({ UserId: user.Id });

      assert.user({ user, Name: 'user' });
      assert.activeProfile({ profile, Bio: 'profile' });
    });

    const testCreateMany = async (queriesCount: number) => {
      const q = db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          profile: {
            create: {
              ...ProfileData,
              Bio: 'profile 1',
            },
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          profile: {
            create: {
              ...ProfileData,
              Bio: 'profile 2',
            },
          },
        },
      ]);

      const users = await q;

      expect(getQueriesCount()).toEqual(queriesCount);

      const profiles = await db.profile
        .where({
          UserId: { in: users.map((user) => user.Id) },
        })
        .order('Id');

      assert.user({ user: users[0], Name: 'user 1' });
      assert.profile({ profile: profiles[0], Bio: 'profile 1' });

      assert.user({ user: users[1], Name: 'user 2' });
      assert.profile({ profile: profiles[1], Bio: 'profile 2' });
    };

    it('should support create many', async () => {
      await testCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testCreateMany(2);
      });
    });

    it('should support deeply nested batch creates', async () => {
      const q = db.user.insertMany([
        {
          ...UserData,
          Name: 'user 1',
          profile: {
            create: {
              ...ProfileData,
              Bio: 'profile 1',
              pic: {
                create: {
                  Url: 'url 1',
                },
              },
            },
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          profile: {
            create: {
              ...ProfileData,
              Bio: 'profile 2',
              pic: {
                create: {
                  Url: 'url 2',
                },
              },
            },
          },
        },
      ]);

      const count = await q;

      expect(getQueriesCount()).toEqual(1);

      expect(count).toBe(2);

      const data = await db.user.select('Name', {
        profile: (q) =>
          q.profile.select('Bio', {
            pic: (q) => q.pic.select('Url'),
          }),
      });

      expect(data).toEqual([
        {
          Name: 'user 1',
          profile: {
            Bio: 'profile 1',
            pic: {
              Url: 'url 1',
            },
          },
        },
        {
          Name: 'user 2',
          profile: {
            Bio: 'profile 2',
            pic: {
              Url: 'url 2',
            },
          },
        },
      ]);
    });

    it('should create many using `on`', async () => {
      const q = db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          activeProfile: {
            create: {
              ...ProfileData,
              Bio: 'profile 1',
            },
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          activeProfile: {
            create: {
              ...ProfileData,
              Bio: 'profile 2',
            },
          },
        },
      ]);

      const users = await q;

      expect(getQueriesCount()).toEqual(1);

      const profiles = await db.profile
        .where({
          UserId: { in: users.map((user) => user.Id) },
        })
        .order('Id');

      assert.user({ user: users[0], Name: 'user 1' });
      assert.activeProfile({ profile: profiles[0], Bio: 'profile 1' });

      assert.user({ user: users[1], Name: 'user 2' });
      assert.activeProfile({ profile: profiles[1], Bio: 'profile 2' });
    });

    describe('relation callbacks', () => {
      const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
        db.user.relations.profile,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        await db.user.create({
          ...UserData,
          profile: {
            create: ProfileData,
          },
        });

        expect(getQueriesCount()).toEqual(1);

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [expect.objectContaining({ Id: expect.any(Number) })],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        await db.user.createMany([
          {
            ...UserData,
            profile: {
              create: ProfileData,
            },
          },
          {
            ...UserData,
            profile: {
              create: ProfileData,
            },
          },
        ]);

        expect(getQueriesCount()).toEqual(1);

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ Id: expect.any(Number) }, { Id: expect.any(Number) }],
          expect.any(Db),
        );
      });
    });

    it('should create the hasOne record in upsert', async () => {
      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            profile: { create: ProfileData },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const profiles = await db.profile.select('UserId', 'ProfileKey', 'Bio');

      expect(profiles).toEqual([
        {
          UserId: user.Id,
          ProfileKey: user.UserKey,
          Bio: ProfileData.Bio,
        },
      ]);
    });
  });

  describe('connect', () => {
    it('should restrict the type', () => {
      db.user.create({
        ...UserData,
        profile: {
          // @ts-expect-error the type is restricted
          connect: 123,
        },
      });
    });

    it('should support connect', async () => {
      await db.profile.create({
        Bio: 'profile',
        user: {
          create: {
            ...UserData,
            Name: 'tmp',
          },
        },
      });

      resetQueriesCount();

      const q = db.user.create({
        ...UserData,
        Name: 'user',
        profile: {
          connect: { Bio: 'profile' },
        },
      });

      const user = await q;

      expect(getQueriesCount()).toBe(1);

      const profile = await db.user.queryRelated('profile', user);

      assert.user({ user, Name: 'user' });
      assert.profile({ profile, Bio: 'profile' });
    });

    it('should fail if record for connect is not found', async () => {
      resetQueriesCount();

      const q = db.user.create({
        ...UserData,
        Name: 'user',
        profile: {
          connect: { Bio: 'profile' },
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toBe(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    it('should fail to connect when `on` condition does not match', async () => {
      await db.profile.create({
        Bio: 'profile',
        user: {
          create: {
            ...UserData,
            Name: 'tmp',
          },
        },
      });

      resetQueriesCount();

      const q = db.user.create({
        ...UserData,
        Name: 'user',
        activeProfile: {
          connect: { Bio: 'profile' },
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toBe(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    const testConnectInCreateMany = async (queriesCount: number) => {
      const user = await db.user.create({ ...UserData, Name: 'tmp' });
      await db.profile.createMany([
        {
          Bio: 'profile 1',
          UserId: user.Id,
          ProfileKey: user.UserKey,
        },
        {
          Bio: 'profile 2',
          UserId: user.Id,
          ProfileKey: user.UserKey,
        },
      ]);

      resetQueriesCount();

      const q = db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          profile: {
            connect: { Bio: 'profile 1' },
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          profile: {
            connect: { Bio: 'profile 2' },
          },
        },
      ]);

      const users = await q;

      expect(getQueriesCount()).toBe(queriesCount);

      const profiles = await db.profile
        .where({
          UserId: { in: users.map((user) => user.Id) },
        })
        .order('Id');

      assert.user({ user: users[0], Name: 'user 1' });
      assert.profile({ profile: profiles[0], Bio: 'profile 1' });

      assert.user({ user: users[1], Name: 'user 2' });
      assert.profile({ profile: profiles[1], Bio: 'profile 2' });
    };

    it('should support connect in batch create', async () => {
      await testConnectInCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testConnectInCreateMany(3);
      });
    });

    it('should fail to connect when `on` condition does not match', async () => {
      await db.profile.create({
        Bio: 'profile',
        user: {
          create: {
            ...UserData,
            Name: 'tmp',
          },
        },
      });
      resetQueriesCount();

      const q = db.user.createMany([
        {
          ...UserData,
          activeProfile: {
            connect: { Bio: 'profile' },
          },
        },
      ]);

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toBe(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.user.relations.profile,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        const profileId = await db.profile.get('Id').create(ProfileData);
        resetQueriesCount();

        await db.user.insert({
          ...UserData,
          profile: {
            connect: { Id: profileId },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: profileId }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        const ids = await db.profile
          .pluck('Id')
          .createMany([ProfileData, ProfileData]);

        resetQueriesCount();

        await db.user.createMany([
          {
            ...UserData,
            profile: {
              connect: { Id: ids[0] },
            },
          },
          {
            ...UserData,
            profile: {
              connect: { Id: ids[1] },
            },
          },
        ]);

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate.mock.calls).toEqual([
          [[{ Id: ids[0] }, { Id: ids[1] }], expect.any(Db)],
        ]);
      });
    });

    it('should connect the hasOne record in upsert', async () => {
      await db.profile.create({
        ...ProfileData,
        ProfileKey: 'tmp',
      });

      resetQueriesCount();

      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            profile: { connect: { Bio: ProfileData.Bio } },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const profiles = await db.profile.select('UserId', 'ProfileKey', 'Bio');

      expect(profiles).toEqual([
        {
          UserId: user.Id,
          ProfileKey: user.UserKey,
          Bio: ProfileData.Bio,
        },
      ]);
    });
  });

  describe('connectOrCreate', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.user.create({
          ...UserData,
          profile: {
            // @ts-expect-error the type is restricted
            connectOrCreate: 123,
          },
        }),
      ).toThrow();
    });

    it('should support connect or create', async () => {
      const profileId = await db.profile.get('Id').create({
        Bio: 'profile 1',
        user: {
          create: {
            ...UserData,
            Name: 'tmp',
          },
        },
      });

      resetQueriesCount();

      const user1 = await db.user.create({
        ...UserData,
        Name: 'user 1',
        profile: {
          connectOrCreate: {
            where: { Bio: 'profile 1' },
            create: { ...ProfileData, Bio: 'profile 1' },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      resetQueriesCount();

      const user2 = await db.user.create({
        ...UserData,
        Name: 'user 2',
        profile: {
          connectOrCreate: {
            where: { Bio: 'profile 2' },
            create: { ...ProfileData, Bio: 'profile 2' },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      const profile1 = await db.user.queryRelated('profile', user1);
      const profile2 = await db.user.queryRelated('profile', user2);

      expect(profile1.Id).toBe(profileId);
      assert.user({ user: user1, Name: 'user 1' });
      assert.profile({ profile: profile1, Bio: 'profile 1' });

      assert.user({ user: user2, Name: 'user 2' });
      assert.profile({ profile: profile2, Bio: 'profile 2' });
    });

    it('should support connect or create using `on`', async () => {
      const [profile1Id, profile2Id] = await db.profile.pluck('Id').createMany([
        {
          Bio: 'profile 1',
          Active: true,
          user: {
            create: {
              ...UserData,
              Name: 'tmp',
            },
          },
        },
        {
          Bio: 'profile 2',
          user: {
            create: {
              ...UserData,
              Name: 'tmp',
            },
          },
        },
      ]);

      resetQueriesCount();

      const user1 = await db.user.create({
        ...UserData,
        Name: 'user 1',
        activeProfile: {
          connectOrCreate: {
            where: { Bio: 'profile 1' },
            create: { ...ProfileData, Bio: 'profile 1' },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      resetQueriesCount();

      const user2 = await db.user.create({
        ...UserData,
        Name: 'user 2',
        activeProfile: {
          connectOrCreate: {
            where: { Bio: 'profile 2' },
            create: { ...ProfileData, Bio: 'profile 2' },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      const profile1 = await db.user.queryRelated('activeProfile', user1);
      const profile2 = await db.user.queryRelated('activeProfile', user2);

      expect(profile1.Id).toBe(profile1Id);
      assert.user({ user: user1, Name: 'user 1' });
      assert.activeProfile({ profile: profile1, Bio: 'profile 1' });

      expect(profile2.Id).not.toBe(profile2Id);
      assert.user({ user: user2, Name: 'user 2' });
      assert.activeProfile({ profile: profile2, Bio: 'profile 2' });
    });

    const testConnectOrCreateInCreateMany = async (queriesCount: number) => {
      const profileId = await db.profile.get('Id').create({
        Bio: 'profile 1',
        user: {
          create: {
            ...UserData,
            Name: 'tmp',
          },
        },
      });

      resetQueriesCount();

      const [user1, user2] = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          profile: {
            connectOrCreate: {
              where: { Bio: 'profile 1' },
              create: { ...ProfileData, Bio: 'profile 1' },
            },
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          profile: {
            connectOrCreate: {
              where: { Bio: 'profile 2' },
              create: { ...ProfileData, Bio: 'profile 2' },
            },
          },
        },
      ]);

      expect(getQueriesCount()).toBe(queriesCount);

      const profile1 = await db.user.queryRelated('profile', user1);
      const profile2 = await db.user.queryRelated('profile', user2);

      expect(profile1.Id).toBe(profileId);
      assert.user({ user: user1, Name: 'user 1' });
      assert.profile({ profile: profile1, Bio: 'profile 1' });

      assert.user({ user: user2, Name: 'user 2' });
      assert.profile({ profile: profile2, Bio: 'profile 2' });
    };

    it('should support connect or create many', async () => {
      await testConnectOrCreateInCreateMany(1);
    });

    describe('too many records', () => {
      useMultiQueryNestedCreate();

      it('should use a multi-query strategy when inserting too many records', async () => {
        await testConnectOrCreateInCreateMany(4);
      });
    });

    it('should connect or create in batch create using `on`', async () => {
      const [profile1Id, profile2Id] = await db.profile.pluck('Id').createMany([
        {
          Bio: 'profile 1',
          Active: true,
          user: {
            create: {
              ...UserData,
              Name: 'tmp',
            },
          },
        },
        {
          Bio: 'profile 2',
          user: {
            create: {
              ...UserData,
              Name: 'tmp',
            },
          },
        },
      ]);

      resetQueriesCount();

      const [user1, user2] = await db.user.createMany([
        {
          ...UserData,
          Name: 'user 1',
          activeProfile: {
            connectOrCreate: {
              where: { Bio: 'profile 1' },
              create: { ...ProfileData, Bio: 'profile 1' },
            },
          },
        },
        {
          ...UserData,
          Name: 'user 2',
          activeProfile: {
            connectOrCreate: {
              where: { Bio: 'profile 2' },
              create: { ...ProfileData, Bio: 'profile 2' },
            },
          },
        },
      ]);

      expect(getQueriesCount()).toBe(1);

      const profile1 = await db.user.queryRelated('activeProfile', user1);
      const profile2 = await db.user.queryRelated('activeProfile', user2);

      expect(profile1.Id).toBe(profile1Id);
      assert.user({ user: user1, Name: 'user 1' });
      assert.activeProfile({ profile: profile1, Bio: 'profile 1' });

      expect(profile2.Id).not.toBe(profile2Id);
      assert.user({ user: user2, Name: 'user 2' });
      assert.activeProfile({ profile: profile2, Bio: 'profile 2' });
    });

    it('should connect or create the hasOne record in upsert', async () => {
      await db.profile.create({
        ...ProfileData,
        ProfileKey: 'tmp',
      });

      resetQueriesCount();

      const user = await db.user
        .select('Id', 'UserKey')
        .find(123)
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            profile: {
              connectOrCreate: {
                where: { Bio: ProfileData.Bio },
                create: ProfileData,
              },
            },
          },
        });

      expect(getQueriesCount()).toBe(2);

      const profiles = await db.profile.select('UserId', 'ProfileKey', 'Bio');

      expect(profiles).toEqual([
        {
          UserId: user.Id,
          ProfileKey: user.UserKey,
          Bio: ProfileData.Bio,
        },
      ]);
    });

    describe('relation callbacks', () => {
      const {
        beforeUpdate,
        afterUpdate,
        beforeCreate,
        afterCreate,
        resetMocks,
      } = useRelationCallback(db.user.relations.profile, ['Id']);

      it('should invoke callbacks when connecting', async () => {
        const Id = await db.profile.get('Id').create(ProfileData);

        resetQueriesCount();

        await db.user.create({
          ...UserData,
          profile: {
            connectOrCreate: {
              where: { Id },
              create: ProfileData,
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith([{ Id }], expect.any(Db));
      });

      it('should invoke callbacks when creating', async () => {
        resetMocks();

        resetQueriesCount();

        await db.user.create({
          ...UserData,
          profile: {
            connectOrCreate: {
              where: { Id: 0 },
              create: ProfileData,
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        const Id = await db.profile.take().get('Id');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith([{ Id }], expect.any(Db));
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        const Id = await db.profile.get('Id').create(ProfileData);

        resetQueriesCount();

        await db.user.createMany([
          {
            ...UserData,
            profile: {
              connectOrCreate: {
                where: { Id: 0 },
                create: ProfileData,
              },
            },
          },
          {
            ...UserData,
            profile: {
              connectOrCreate: {
                where: { Id },
                create: ProfileData,
              },
            },
          },
        ]);

        expect(getQueriesCount()).toBe(1);

        const ids = (await db.profile.pluck('Id')).sort((a, b) => a - b);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: ids[0] }],
          expect.any(Db),
        );

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ Id: ids[1] }],
          expect.any(Db),
        );
      });
    });
  });
});
