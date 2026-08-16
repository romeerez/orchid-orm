import { Db } from 'pqb';
import {
  useQueryCounter,
  useRelationCallback,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import { db, UserData, ProfileData } from 'test-utils';

describe('hasOne update', () => {
  useTestORM();

  const { resetQueriesCount, getQueriesCount } = useQueryCounter();

  const activeProfileData = { ...ProfileData, Active: true };

  describe('disconnect', () => {
    it('should restrict the type', () => {
      db.user.where({ Id: 1 }).update({
        profile: {
          // @ts-expect-error the type is restricted
          disconnect: 123,
        },
      });
    });

    it('should nullify foreignKey', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const { Id: profileId } = await db.user.queryRelated('profile', user);

      resetQueriesCount();

      const Id = await db.user
        .get('Id')
        .find(user.Id)
        .update({
          profile: {
            disconnect: true,
          },
        });

      expect(getQueriesCount()).toBe(1);

      expect(Id).toBe(user.Id);

      const profile = await db.profile.find(profileId);
      expect(profile.UserId).toBe(null);
    });

    it('should nullify foreignKey in upsert update branch', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      await db.user.find(user.Id).upsert({
        update: { profile: { disconnect: true } },
        create: { ...UserData, profile: { create: ProfileData } },
      });

      const profile = await db.profile.findByOptional({ UserId: user.Id });
      expect(profile).toBe(undefined);
    });

    it('should not nullify foreignKey when `on` condition does not match', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const { Id: profileId } = await db.user.queryRelated('profile', user);

      resetQueriesCount();

      const Id = await db.user
        .get('Id')
        .where(user)
        .update({
          activeProfile: {
            disconnect: true,
          },
        });

      expect(getQueriesCount()).toBe(1);

      expect(Id).toBe(user.Id);

      const profile = await db.profile.find(profileId);
      expect(profile.UserId).toBe(user.Id);
    });

    it('should nullify foreignKey in batch update', async () => {
      const userIds = await db.user.pluck('Id').createMany([
        { ...UserData, profile: { create: ProfileData } },
        { ...UserData, profile: { create: ProfileData } },
      ]);

      const profileIds = await db.profile.pluck('Id').where({
        UserId: { in: userIds },
      });

      resetQueriesCount();

      const count = await db.user.where({ Id: { in: userIds } }).update({
        profile: {
          disconnect: true,
        },
      });
      expect(count).toBe(2);

      expect(getQueriesCount()).toBe(1);

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } });
      expect(updatedUserIds).toEqual([null, null]);
    });

    it('should not nullify foreignKey in batch update when `on` condition does not match', async () => {
      const userIds = await db.user
        .pluck('Id')
        .createMany([{ ...UserData, profile: { create: ProfileData } }]);

      const profileIds = await db.profile.pluck('Id').where({
        UserId: { in: userIds },
      });

      resetQueriesCount();

      const count = await db.user.where({ Id: { in: userIds } }).update({
        activeProfile: {
          disconnect: true,
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } });

      expect(updatedUserIds).toEqual(userIds);
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.user.relations.profile,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        const { Id, UserId } = await db.profile.select('Id', 'UserId').create({
          user: { create: UserData },
        });

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            disconnect: true,
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith([{ Id: Id }], expect.any(Db));
      });

      it('should invoke callbacks in a batch update', async () => {
        resetMocks();

        const userIds = await db.user.pluck('Id').createMany([
          {
            ...UserData,
            profile: { create: ProfileData },
          },
          {
            ...UserData,
            profile: { create: ProfileData },
          },
        ]);

        resetQueriesCount();

        const count = await db.user.where({ Id: { in: userIds } }).update({
          profile: {
            disconnect: true,
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(2);

        const ids = await db.profile.pluck('Id');

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: ids[0] }, { Id: ids[1] }],
          expect.any(Db),
        );
      });
    });
  });

  describe('set', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.user.where({ Id: 1 }).update({
          profile: {
            // @ts-expect-error the type is restricted
            set: 123,
          },
        }),
      ).toThrow();
    });

    it('should nullify foreignKey of previous related record and set foreignKey to new related record', async () => {
      const Id = await db.user.get('Id').create(UserData);

      const [{ Id: profile1Id }, { Id: profile2Id }] = await db.profile
        .select('Id')
        .createMany([{ ...ProfileData, UserId: Id }, { ...ProfileData }]);

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        profile: {
          set: { Id: profile2Id },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile1 = await db.profile.find(profile1Id);
      expect(profile1.UserId).toBe(null);

      const profile2 = await db.profile.find(profile2Id);
      expect(profile2.UserId).toBe(Id);
    });

    it('should set related record in upsert update branch', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });
      const profile = await db.profile.select('Id').create(ProfileData);

      await db.user.find(user.Id).upsert({
        update: { profile: { set: profile } },
        create: { ...UserData, profile: { create: ProfileData } },
      });

      const related = await db.user.queryRelated('profile', user);
      expect(related.Id).toBe(profile.Id);
    });

    it('should not nullify when `on` condition does not match, and update foreignKey of the new record', async () => {
      const Id = await db.user.get('Id').create(UserData);

      const [{ Id: profile1Id }, { Id: profile2Id }] = await db.profile
        .select('Id')
        .createMany([
          { ...ProfileData, UserId: Id },
          { ...ProfileData, Active: true },
        ]);

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        activeProfile: {
          set: { Id: profile2Id },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile1 = await db.profile.find(profile1Id);
      expect(profile1.UserId).toBe(Id);

      const profile2 = await db.profile.find(profile2Id);
      expect(profile2.UserId).toBe(Id);
    });

    it('should throw in batch update', async () => {
      expect(() =>
        db.user.where({ Id: { in: [1, 2, 3] } }).update({
          profile: {
            // @ts-expect-error not allows in batch update
            set: { Id: 1 },
          },
        }),
      ).toThrow('`set` option is not allowed in a batch update');
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.user.relations.profile,
        ['Id'],
      );

      beforeEach(resetMocks);

      it('should not fire update twice for the same record that was set before and is set again', async () => {
        const { Id: profileId, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            set: { Id: profileId },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: profileId }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks', async () => {
        const { Id: prevId, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        const newId = await db.profile.get('Id').create(ProfileData);

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            set: { Id: newId },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: prevId }, { Id: newId }],
          expect.any(Db),
        );
      });
    });
  });

  describe('delete', () => {
    it('should restrict the type', () => {
      db.user.where({ Id: 1 }).update({
        profile: {
          // @ts-expect-error the type is restricted
          delete: 123,
        },
      });
    });

    it('should delete related record', async () => {
      const Id = await db.user
        .get('Id')
        .create({ ...UserData, profile: { create: ProfileData } });

      const { Id: profileId } = await db.user
        .queryRelated('profile', { Id, UserKey: 'key' })
        .select('Id')
        .take();

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        profile: {
          delete: true,
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.profile.findByOptional({ Id: profileId });
      expect(profile).toBe(undefined);
    });

    it('should delete related record in upsert update branch', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });
      const profile = await db.user.queryRelated('profile', user);

      await db.user.find(user.Id).upsert({
        update: { profile: { delete: true } },
        create: { ...UserData, profile: { create: ProfileData } },
      });

      expect(await db.profile.findByOptional({ Id: profile.Id })).toBe(
        undefined,
      );
    });

    it('should not delete when `on` condition does not match', async () => {
      const Id = await db.user
        .get('Id')
        .create({ ...UserData, profile: { create: ProfileData } });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        activeProfile: {
          delete: true,
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profiles = await db.profile;

      expect(profiles.length).toBe(1);
    });

    it('should delete related record in batch update', async () => {
      const userIds = await db.user.pluck('Id').createMany([
        { ...UserData, profile: { create: ProfileData } },
        { ...UserData, profile: { create: ProfileData } },
      ]);

      resetQueriesCount();

      const updated = await db.user.where({ Id: { in: userIds } }).update({
        profile: {
          delete: true,
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(updated).toBe(2);

      const count = await db.profile.count();
      expect(count).toBe(0);
    });

    it('should not to delete in batch update when `on` condition does not match', async () => {
      const userIds = await db.user.pluck('Id').createMany([
        { ...UserData, profile: { create: ProfileData } },
        { ...UserData, profile: { create: ProfileData } },
      ]);

      resetQueriesCount();

      const count = await db.user.where({ Id: { in: userIds } }).update({
        activeProfile: {
          delete: true,
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const profiles = await db.profile;

      expect(profiles.length).toBe(2);
    });

    describe('relation callbacks', () => {
      const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
        db.user.relations.profile,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            delete: true,
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledWith([{ Id }], expect.any(Db));
      });

      it('should invoke callbacks in a batch update', async () => {
        resetMocks();

        const data = await db.profile.select('Id', 'UserId').createMany([
          { Bio: 'bio', user: { create: UserData } },
          { Bio: 'bio', user: { create: UserData } },
        ]);

        resetQueriesCount();

        const count = await db.user
          .where({ Id: { in: data.map((p) => p.UserId as number) } })
          .update({
            profile: {
              delete: true,
            },
          });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(2);

        expect(beforeDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledWith(
          [{ Id: data[0].Id }, { Id: data[1].Id }],
          expect.any(Db),
        );
      });
    });
  });

  describe('update', () => {
    it('should restrict the type', () => {
      db.user.where({ Id: 1 }).update({
        profile: {
          // @ts-expect-error the type is restricted
          update: 123,
        },
      });
    });

    it('should update related record', async () => {
      const Id = await db.user
        .get('Id')
        .create({ ...UserData, profile: { create: ProfileData } });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        profile: {
          update: {
            Bio: 'updated',
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.user
        .queryRelated('profile', { Id, UserKey: 'key' })
        .take();

      expect(profile.Bio).toBe('updated');
    });

    it('should update related record in upsert update branch', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      await db.user.find(user.Id).upsert({
        update: { profile: { update: { Bio: 'updated' } } },
        create: { ...UserData, profile: { create: ProfileData } },
      });

      const profile = await db.user.queryRelated('profile', user);
      expect(profile.Bio).toBe('updated');
    });

    it('should not update when `on` condition does not match', async () => {
      const Id = await db.user
        .get('Id')
        .create({ ...UserData, profile: { create: ProfileData } });

      resetQueriesCount();

      const count = await db.user.find(Id).update({
        activeProfile: {
          update: {
            Bio: 'updated',
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.user
        .queryRelated('profile', { Id, UserKey: 'key' })
        .take();

      expect(profile.Bio).not.toBe('updated');
    });

    it('should update related record in batch update', async () => {
      const userIds = await db.user.pluck('Id').createMany([
        { ...UserData, profile: { create: ProfileData } },
        { ...UserData, profile: { create: ProfileData } },
      ]);

      resetQueriesCount();

      const count = await db.user.where({ Id: { in: userIds } }).update({
        profile: {
          update: {
            Bio: 'updated',
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const bios = await db.profile.pluck('Bio');
      expect(bios).toEqual(['updated', 'updated']);
    });

    it('should update records in batch update only where `on` condition does match', async () => {
      const userIds = await db.user.pluck('Id').createMany([
        { ...UserData, profile: { create: ProfileData } },
        { ...UserData, profile: { create: activeProfileData } },
      ]);

      resetQueriesCount();

      const count = await db.user.where({ Id: { in: userIds } }).update({
        activeProfile: {
          update: {
            Bio: 'updated',
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(2);

      const bios = await db.profile.order('Bio').pluck('Bio');
      expect(bios).toEqual(['bio', 'updated']);
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.user.relations.profile,
        ['Id'],
      );

      it('should invoke callbacks', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            update: {
              Bio: 'updated',
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith([{ Id }], expect.any(Db));
      });

      it('should invoke callbacks in a batch update', async () => {
        resetMocks();

        const data = await db.profile.select('Id', 'UserId').createMany([
          { Bio: 'bio', user: { create: UserData } },
          { Bio: 'bio', user: { create: UserData } },
        ]);

        resetQueriesCount();

        const count = await db.user
          .where({ Id: { in: data.map((p) => p.UserId as number) } })
          .update({
            profile: {
              update: {
                Bio: 'updated',
              },
            },
          });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(2);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: data[0].Id }, { Id: data[1].Id }],
          expect.any(Db),
        );
      });
    });
  });

  describe('upsert', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.user.where({ Id: 1 }).update({
          profile: {
            // @ts-expect-error the type is restricted
            upsert: 123,
          },
        }),
      ).toThrow();
    });

    it('should update related record if it exists', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      resetQueriesCount();

      const count = await db.user.find(user.Id).update({
        profile: {
          upsert: {
            update: {
              Bio: 'updated',
            },
            create: ProfileData,
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.user.queryRelated('profile', user);
      expect(profile.Bio).toBe('updated');
    });

    it('should upsert related record in upsert update branch', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      await db.user.find(user.Id).upsert({
        update: {
          profile: {
            upsert: {
              update: { Bio: 'updated' },
              create: { ...ProfileData, Bio: 'created' },
            },
          },
        },
        create: { ...UserData, profile: { create: ProfileData } },
      });

      const profile = await db.user.queryRelated('profile', user);
      expect(profile.Bio).toBe('updated');
    });

    it('should create related record if it does not exists', async () => {
      const user = await db.user.create(UserData);

      resetQueriesCount();

      const count = await db.user.find(user.Id).update({
        profile: {
          upsert: {
            update: {
              Bio: 'updated',
            },
            create: {
              ...ProfileData,
              Bio: 'created',
            },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.user.queryRelated('profile', user);
      expect(profile.Bio).toBe('created');
    });

    it('should create related record if it does not exists with a data from a callback', async () => {
      const user = await db.user.create(UserData);

      resetQueriesCount();

      const count = await db.user.find(user.Id).update({
        profile: {
          upsert: {
            update: {
              Bio: 'updated',
            },
            create: () => ({
              ...ProfileData,
              Bio: 'created',
            }),
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.user.queryRelated('profile', user);
      expect(profile.Bio).toBe('created');
    });

    it('should create a related record `when` on condition does not match for the update', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      resetQueriesCount();

      const count = await db.user.find(user.Id).update({
        activeProfile: {
          upsert: {
            update: {
              Bio: 'updated',
            },
            create: {
              ...ProfileData,
              Bio: 'created',
            },
          },
        },
      });

      expect(getQueriesCount()).toBe(1);

      expect(count).toBe(1);

      const profile = await db.user.queryRelated('activeProfile', user);
      expect(profile.Bio).toBe('created');
    });

    it('should throw in batch update', async () => {
      expect(() =>
        db.user.where({ Id: { in: [1, 2, 3] } }).update({
          profile: {
            // @ts-expect-error not allows in batch update
            upsert: {
              update: {
                Bio: 'updated',
              },
              create: {
                ...ProfileData,
                Bio: 'created',
              },
            },
          },
        }),
      ).toThrow('`upsert` option is not allowed in a batch update');
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
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            upsert: {
              update: {
                Bio: 'updated',
              },
              create: ProfileData,
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith([{ Id }], expect.any(Db));
      });

      it('should invoke callbacks when creating', async () => {
        resetMocks();

        const userId = await db.user.get('Id').create(UserData);

        resetQueriesCount();

        const count = await db.user.find(userId).update({
          profile: {
            upsert: {
              update: {
                Bio: 'updated',
              },
              create: ProfileData,
            },
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        const profile = await db.profile.select('Id').take();

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith([profile], expect.any(Db));
      });
    });
  });

  describe('create', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.user.where({ Id: 1 }).update({
          profile: {
            // @ts-expect-error the type is restricted
            create: 123,
          },
        }),
      ).toThrow();
    });

    it('should create new related record', async () => {
      const userId = await db.user
        .get('Id')
        .create({ ...UserData, profile: { create: ProfileData } });

      const previousProfileId = await db.user
        .queryRelated('profile', { Id: userId, UserKey: 'key' })
        .get('Id');

      resetQueriesCount();

      const updated = await db.user
        .selectAll()
        .find(userId)
        .update({
          profile: {
            create: { ...ProfileData, Bio: 'created' },
          },
        });

      expect(getQueriesCount()).toBe(1);

      const previousProfile = await db.profile.find(previousProfileId);
      expect(previousProfile.UserId).toBe(null);

      const profile = await db.user.queryRelated('profile', updated);
      expect(profile.Bio).toBe('created');
    });

    it('should create new related record in upsert update branch', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      await db.user.find(user.Id).upsert({
        update: { profile: { create: { ...ProfileData, Bio: 'created' } } },
        create: { ...UserData, profile: { create: ProfileData } },
      });

      const profile = await db.user.queryRelated('profile', user);
      expect(profile.Bio).toBe('created');
    });

    it('should create new related record using `on`', async () => {
      const userId = await db.user
        .get('Id')
        .create({ ...UserData, profile: { create: ProfileData } });

      const previousProfileId = await db.user
        .queryRelated('profile', { Id: userId, UserKey: 'key' })
        .get('Id');

      resetQueriesCount();

      const updated = await db.user
        .selectAll()
        .find(userId)
        .update({
          activeProfile: {
            create: { ...ProfileData, Bio: 'created' },
          },
        });

      expect(getQueriesCount()).toBe(1);

      const previousProfile = await db.profile.find(previousProfileId);
      expect(previousProfile.UserId).toBe(userId);

      const profile = await db.user.queryRelated('activeProfile', updated);
      expect(profile.Bio).toBe('created');
    });

    it('should throw in batch update', async () => {
      expect(() =>
        db.user.where({ Id: { in: [1, 2, 3] } }).update({
          profile: {
            // @ts-expect-error not allows in batch update
            create: {
              ...ProfileData,
              Bio: 'created',
            },
          },
        }),
      ).toThrow('`create` option is not allowed in a batch update');
    });

    describe('relation callbacks', () => {
      const {
        beforeUpdate,
        afterUpdate,
        beforeCreate,
        afterCreate,
        resetMocks,
      } = useRelationCallback(db.user.relations.profile, ['Id']);

      it('should invoke callbacks to disconnect previous and create new', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create({ Bio: 'bio', user: { create: UserData } });

        resetMocks();

        resetQueriesCount();

        const count = await db.user.find(UserId as number).update({
          profile: {
            create: ProfileData,
          },
        });

        expect(getQueriesCount()).toBe(1);

        expect(count).toBe(1);

        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith([{ Id }], expect.any(Db));

        const newId = await db.profile.findBy({ UserId }).get('Id');

        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ Id: newId }],
          expect.any(Db),
        );
      });
    });
  });
});
