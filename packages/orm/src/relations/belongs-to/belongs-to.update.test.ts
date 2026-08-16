import { Db, NotFoundError } from 'pqb';
import {
  useQueryCounter,
  useRelationCallback,
  useTestORM,
} from '../../test-utils/orm.test-utils';
import { db, UserData, ProfileData } from 'test-utils';

describe('belongsTo update', () => {
  useTestORM();

  const { resetQueriesCount, getQueriesCount } = useQueryCounter();

  describe('disconnect', () => {
    it('should restrict the type', () => {
      db.profile.where({ Id: 1 }).update({
        user: {
          // @ts-expect-error the type is restricted
          disconnect: 123,
        },
      });
    });

    it('should nullify foreignKey', async () => {
      const id = await db.profile
        .get('Id')
        .create({ Bio: 'bio', user: { create: UserData } });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId')
        .find(id)
        .update({
          Bio: 'string',
          user: { disconnect: true },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(profile.UserId).toBe(null);
    });

    it('should disconnect in upsert update branch', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: { create: UserData },
      });

      const updated = await db.profile
        .select('UserId')
        .find(profile.Id)
        .upsert({
          update: { user: { disconnect: true } },
          create: { ...ProfileData, user: { create: UserData } },
        });

      expect(updated.UserId).toBe(null);
    });

    it('should nullify even if `on` condition does not match, the will of disconnect prevails over `on`', async () => {
      const id = await db.profile
        .get('Id')
        .create({ Bio: 'bio', user: { create: UserData } });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId')
        .find(id)
        .update({
          Bio: 'string',
          activeUser: { disconnect: true },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(profile.UserId).toBe(null);
    });

    it('should nullify foreignKey in batch update using `on`', async () => {
      const ids = await db.profile.pluck('Id').createMany([
        { Bio: 'bio', user: { create: UserData } },
        { Bio: 'bio', user: { create: UserData } },
      ]);

      resetQueriesCount();

      const userIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: ids } })
        .update({
          Bio: 'string',
          activeUser: { disconnect: true },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(userIds).toEqual([null, null]);
    });
  });

  describe('set', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.profile.where({ Id: 1 }).update({
          user: {
            // @ts-expect-error the type is restricted
            set: 123,
          },
        }),
      ).toThrow();
    });

    it('should set foreignKey of current record with provided primaryKey', async () => {
      const firstUserId = await db.user.get('Id').create(UserData);
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: firstUserId });
      const user = await db.user.select('Id').create(UserData);

      resetQueriesCount();

      const profile = await db.profile
        .selectAll()
        .find(id)
        .update({
          user: {
            set: user,
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(profile.UserId).toBe(user.Id);
    });

    it('should set foreignKey in upsert update branch', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: { create: UserData },
      });
      const user = await db.user.select('Id').create({
        ...UserData,
        UserKey: 'upsert-set',
      });

      const updated = await db.profile
        .select('UserId')
        .find(profile.Id)
        .upsert({
          update: { user: { set: user } },
          create: { ...ProfileData, user: { create: UserData } },
        });

      expect(updated.UserId).toBe(user.Id);
    });

    it('should fail to set when `on` condition does not match', async () => {
      const firstUserId = await db.user.get('Id').create(UserData);
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: firstUserId });
      const user = await db.user.select('Id').create(UserData);

      resetQueriesCount();

      const q = db.profile.find(id).update({
        activeUser: {
          set: user,
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toEqual(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    it('should set foreignKey of current record from found related record', async () => {
      const firstUserId = await db.user.get('Id').create(UserData);
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: firstUserId });
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'user',
      });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId')
        .find(id)
        .update({
          user: {
            set: { Name: 'user' },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(profile.UserId).toBe(user.Id);
    });

    it('should fail to set foreignKey of current record from found record if `on` condition does not match', async () => {
      const firstUserId = await db.user.get('Id').create(UserData);
      const id = await db.profile
        .get('Id')
        .create({ ...ProfileData, UserId: firstUserId });
      await db.user.select('Id').create({
        ...UserData,
        Name: 'user',
      });

      resetQueriesCount();

      const q = db.profile.find(id).update({
        activeUser: {
          set: { Name: 'user' },
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toEqual(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    it('should set foreignKey of current record with provided primaryKey in batch update', async () => {
      const UserId = await db.user.get('Id').create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId },
        { ...ProfileData, UserId },
      ]);
      const user = await db.user.select('Id').create(UserData);

      resetQueriesCount();

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } })
        .update({
          user: {
            set: user,
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(updatedUserIds).toEqual([user.Id, user.Id]);
    });

    it('should fail to set foreignKey of current record in a batch update when `on` condition does not match', async () => {
      const UserId = await db.user.get('Id').create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId },
        { ...ProfileData, UserId },
      ]);
      const user = await db.user.select('Id').create(UserData);

      resetQueriesCount();

      const q = db.profile.where({ Id: { in: profileIds } }).update({
        activeUser: {
          set: user,
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toEqual(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });

    it('should set foreignKey of current record from found related record in batch update', async () => {
      const firstUserId = await db.user.get('Id').create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId: firstUserId },
        { ...ProfileData, UserId: firstUserId },
      ]);
      const user = await db.user.select('Id').create({
        ...UserData,
        Name: 'user',
      });

      resetQueriesCount();

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } })
        .update({
          user: {
            set: { Name: 'user' },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(updatedUserIds).toEqual([user.Id, user.Id]);
    });

    it('should fail to set foreignKey of current record in a batch update when `on` condition does not match', async () => {
      const firstUserId = await db.user.get('Id').create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId: firstUserId },
        { ...ProfileData, UserId: firstUserId },
      ]);
      await db.user.select('Id').create({
        ...UserData,
        Name: 'user',
      });
      resetQueriesCount();

      const q = db.profile.where({ Id: { in: profileIds } }).update({
        activeUser: {
          set: { Name: 'user' },
        },
      });

      const res = await q.catch((err) => err);

      expect(getQueriesCount()).toEqual(1);

      expect(res).toEqual(expect.any(NotFoundError));
    });
  });

  describe('delete', () => {
    it('should restrict the type', () => {
      db.profile.where({ Id: 1 }).update({
        user: {
          // @ts-expect-error the type is restricted
          delete: 123,
        },
      });
    });

    it('should nullify foreignKey and delete related record', async () => {
      const { Id, UserId } = await db.profile
        .select('Id', 'UserId')
        .create({ Bio: 'bio', user: { create: UserData } });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId')
        .find(Id)
        .update({
          user: {
            delete: true,
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(profile.UserId).toBe(null);

      const user = await db.user.findByOptional({ Id: UserId });
      expect(user).toBe(undefined);
    });

    it('should delete related record in upsert update branch', async () => {
      const profile = await db.profile
        .select('Id', 'UserId')
        .create({ Bio: 'bio', user: { create: UserData } });

      const updated = await db.profile
        .select('UserId')
        .find(profile.Id)
        .upsert({
          update: { user: { delete: true } },
          create: { ...ProfileData, user: { create: UserData } },
        });

      expect(updated.UserId).toBe(null);
      expect(await db.user.findByOptional({ Id: profile.UserId })).toBe(
        undefined,
      );
    });

    it('should nullify but not delete related record when `on` condition does not match', async () => {
      const { Id, UserId } = await db.profile
        .select('Id', 'UserId')
        .create({ Bio: 'bio', user: { create: UserData } });

      resetQueriesCount();

      const profile = await db.profile
        .select('UserId')
        .find(Id)
        .update({
          activeUser: {
            delete: true,
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(profile.UserId).toBe(null);

      const exists = await db.user.findByOptional({ Id: UserId }).exists();
      expect(exists).toBe(true);
    });

    it('should nullify foreignKey and delete related record in batch update', async () => {
      const user = await db.user.selectAll().create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId: user.Id },
        { ...ProfileData, UserId: user.Id },
      ]);

      resetQueriesCount();

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } })
        .update({
          user: {
            delete: true,
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(updatedUserIds).toEqual([null, null]);

      const deletedUser = await db.user.findOptional(user.Id);
      expect(deletedUser).toBe(undefined);
    });

    it('should nullify but not delete related record in batch update when `on` condition does not match', async () => {
      const user = await db.user.selectAll().create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId: user.Id, Active: true },
        { ...ProfileData, UserId: user.Id },
      ]);

      resetQueriesCount();

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } })
        .update({
          activeUser: {
            delete: true,
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(updatedUserIds).toEqual([null, null]);

      const exists = await db.user.findOptional(user.Id).exists();
      expect(exists).toBe(true);
    });

    describe('relation callbacks', () => {
      const { beforeDelete, afterDelete, resetMocks } = useRelationCallback(
        db.profile.relations.user,
        ['Id'],
      );

      const profileWithUserData = {
        Bio: 'bio',
        user: {
          create: UserData,
        },
      };

      const data = {
        user: {
          delete: true,
        },
      };

      it('should invoke callbacks', async () => {
        const Id = await db.profile.get('Id').create(profileWithUserData);
        resetQueriesCount();

        await db.profile.find(Id).update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(beforeDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledWith(
          [{ Id: expect.any(Number) }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch delete', async () => {
        resetMocks();
        const profiles = await db.profile
          .select('Id', 'UserId')
          .createMany([profileWithUserData, profileWithUserData]);
        resetQueriesCount();

        await db.profile
          .where({ Id: { in: profiles.map((p) => p.Id) } })
          .update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(beforeDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledTimes(1);
        expect(afterDelete).toHaveBeenCalledWith(
          profiles.map((p) => ({ Id: p.UserId })),
          expect.any(Db),
        );
      });
    });
  });

  describe('update', () => {
    it('should restrict the type', () => {
      db.profile.where({ Id: 1 }).update({
        user: {
          // @ts-expect-error the type is restricted
          update: 123,
        },
      });
    });

    it('should update related record', async () => {
      const { Id, UserId } = await db.profile
        .select('Id', 'UserId')
        .create({ Bio: 'bio', user: { create: UserData } });
      resetQueriesCount();

      const updated = await db.profile.find(Id).update({
        user: {
          update: {
            Name: 'new name',
          },
        },
      });

      expect(getQueriesCount()).toEqual(1);

      expect(updated).toBe(1);

      const user = await db.user.findBy({ Id: UserId });
      expect(user.Name).toBe('new name');
    });

    it('should update related record in upsert update branch', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: { create: UserData },
      });

      await db.profile.find(profile.Id).upsert({
        update: { user: { update: { Name: 'new name' } } },
        create: { ...ProfileData, user: { create: UserData } },
      });

      expect((await db.profile.queryRelated('user', profile))?.Name).toBe(
        'new name',
      );
    });

    it('should not update related records when `on` condition does not match', async () => {
      const { Id, UserId } = await db.profile
        .select('Id', 'UserId')
        .create({ Bio: 'bio', user: { create: UserData } });
      resetQueriesCount();

      const count = await db.profile.find(Id).update({
        activeUser: {
          update: {
            Name: 'new name',
          },
        },
      });

      expect(getQueriesCount()).toEqual(1);

      expect(count).toBe(1);

      const user = await db.user.findBy({ Id: UserId });
      expect(user.Name).toBe(UserData.Name);
    });

    it('should update related records in batch update', async () => {
      const profiles = await db.profile.select('Id', 'UserId').createMany([
        { Bio: 'bio', user: { create: UserData } },
        { Bio: 'bio', user: { create: UserData } },
      ]);
      resetQueriesCount();

      const count = await db.profile
        .where({ Id: { in: profiles.map((profile) => profile.Id) } })
        .update({
          user: {
            update: {
              Name: 'new name',
            },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(count).toBe(2);

      const userIds = profiles
        .map((profile) => profile.UserId)
        .filter((id): id is number => id !== null);
      if (userIds.length !== profiles.length) {
        throw new Error('Missing UserId');
      }

      const updatedNames = await db.user.pluck('Name').where({
        Id: { in: userIds },
      });
      expect(updatedNames).toEqual(['new name', 'new name']);
    });

    it('should update only matching by `on` condition records in a batch update', async () => {
      const profiles = await db.profile.select('Id', 'UserId').createMany([
        { Bio: 'bio', user: { create: { ...UserData, Active: true } } },
        { Bio: 'bio', user: { create: UserData } },
      ]);

      resetQueriesCount();

      const count = await db.profile
        .where({ Id: { in: profiles.map((profile) => profile.Id) } })
        .update({
          activeUser: {
            update: {
              Name: 'new name',
            },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(count).toBe(2);

      const userIds = profiles
        .map((profile) => profile.UserId)
        .filter((id): id is number => id !== null);
      if (userIds.length !== profiles.length) {
        throw new Error('Missing UserId');
      }

      const updatedNames = await db.user
        .pluck('Name')
        .where({
          Id: { in: userIds },
        })
        .order('Id');

      expect(updatedNames).toEqual(['new name', UserData.Name]);
    });

    describe('relation callbacks', () => {
      const { beforeUpdate, afterUpdate, resetMocks } = useRelationCallback(
        db.profile.relations.user,
        ['Id'],
      );

      const profileWithUserData = {
        Bio: 'bio',
        user: {
          create: UserData,
        },
      };

      const data = {
        user: {
          update: {
            Name: 'new name',
          },
        },
      };

      it('should invoke callbacks', async () => {
        const { Id, UserId } = await db.profile
          .select('Id', 'UserId')
          .create(profileWithUserData);

        resetQueriesCount();

        const count = await db.profile.find(Id).update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(count).toBe(1);
        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: UserId }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch create', async () => {
        resetMocks();

        const profiles = await db.profile
          .select('Id', 'UserId')
          .createMany([profileWithUserData, profileWithUserData]);

        resetQueriesCount();

        const count = await db.profile
          .where({ Id: { in: profiles.map((p) => p.Id) } })
          .update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(count).toBe(2);
        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          profiles.map((p) => ({ Id: p.UserId })),
          expect.any(Db),
        );
      });
    });
  });

  describe('upsert', () => {
    it('should restrict the type', () => {
      expect(() =>
        db.profile.where({ Id: 1 }).update({
          user: {
            // @ts-expect-error the type is restricted
            upsert: 123,
          },
        }),
      ).toThrow();
    });

    it('should update related record if it exists', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: {
          create: UserData,
        },
      });

      resetQueriesCount();

      const count = await db.profile.find(profile.Id).update({
        user: {
          upsert: {
            update: {
              Name: 'updated',
            },
            create: UserData,
          },
        },
      });

      expect(getQueriesCount()).toEqual(1);

      expect(count).toBe(1);

      const user = await db.profile.queryRelated('user', profile);
      expect(user?.Name).toBe('updated');
    });

    it('should upsert related record in upsert update branch', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: { create: UserData },
      });

      await db.profile.find(profile.Id).upsert({
        update: {
          user: {
            upsert: {
              update: { Name: 'updated' },
              create: {
                ...UserData,
                UserKey: 'upsert-nested',
                Name: 'created',
              },
            },
          },
        },
        create: { ...ProfileData, user: { create: UserData } },
      });

      expect((await db.profile.queryRelated('user', profile))?.Name).toBe(
        'updated',
      );
    });

    it('should create related record if it does not exist', async () => {
      const profile = await db.profile.create(ProfileData);

      resetQueriesCount();

      const count = await db.profile.find(profile.Id).update({
        user: {
          upsert: {
            update: {
              Name: 'updated',
            },
            create: {
              ...UserData,
              Name: 'created',
            },
          },
        },
      });

      expect(getQueriesCount()).toEqual(1);

      expect(count).toBe(1);

      const profiles = await db.profile.select('*', { user: (q) => q.user });
      expect(profiles).toMatchObject([
        {
          Id: profile.Id,
          user: { Name: 'created' },
        },
      ]);
    });

    it('should create related record if it does not exist with a data from a callback', async () => {
      const profile = await db.profile.create(ProfileData);

      resetQueriesCount();

      const updated = await db.profile
        .selectAll()
        .find(profile.Id)
        .update({
          user: {
            upsert: {
              update: {
                Name: 'updated',
              },
              create: () => ({
                ...UserData,
                Name: 'created',
              }),
            },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      const user = await db.profile.queryRelated('user', updated);
      expect(user?.Name).toBe('created');
    });

    it('should create a related record when `on` condition does not match for the update', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: {
          create: UserData,
        },
      });

      resetQueriesCount();

      const updated = await db.profile
        .selectAll()
        .find(profile.Id)
        .update({
          activeUser: {
            upsert: {
              update: {
                Name: 'updated',
              },
              create: {
                ...UserData,
                Name: 'created',
              },
            },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      const user = await db.profile.queryRelated('user', updated);
      expect(user?.Name).toBe('created');
    });

    it('should throw in batch update', () => {
      expect(() =>
        db.profile.where({ Id: 1 }).update({
          user: {
            // @ts-expect-error not allows in batch update
            upsert: {
              update: {
                Name: 'updated',
              },
              create: {
                ...UserData,
                Name: 'created',
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
      } = useRelationCallback(db.profile.relations.user, ['Id']);

      const data = {
        user: {
          upsert: {
            update: {
              Name: 'new name',
            },
            create: UserData,
          },
        },
      };

      it('should invoke update callbacks when updating', async () => {
        const { Id, UserId, ProfileKey } = await db.profile
          .select('Id', 'UserId', 'ProfileKey')
          .create({
            Bio: 'bio',
            user: {
              create: UserData,
            },
          });
        resetMocks();

        resetQueriesCount();

        const count = await db.profile.find(Id).update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(count).toBe(1);
        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).toHaveBeenCalledWith(
          [{ Id: UserId, UserKey: ProfileKey }],
          expect.any(Db),
        );
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).not.toHaveBeenCalled();
      });

      it('should invoke create callbacks when creating', async () => {
        resetMocks();

        const Id = await db.profile.get('Id').create(ProfileData);

        resetQueriesCount();

        const count = await db.profile.find(Id).update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(count).toBe(1);
        expect(beforeUpdate).toHaveBeenCalledTimes(1);
        expect(afterUpdate).not.toHaveBeenCalled();
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ Id: expect.any(Number), UserKey: 'key' }],
          expect.any(Db),
        );
      });
    });
  });

  describe('create', () => {
    it('should restrict the type', () => {
      db.profile.where({ Id: 1 }).update({
        user: {
          // @ts-expect-error the type is restricted
          create: 123,
        },
      });
    });

    it('should create new related record and update foreignKey', async () => {
      const profileId = await db.profile
        .get('Id')
        .create({ Bio: 'bio', user: { create: UserData } });

      resetQueriesCount();

      const updated = await db.profile
        .selectAll()
        .find(profileId)
        .update({
          user: {
            create: { ...UserData, Name: 'created' },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      const user = await db.profile.queryRelated('user', updated);
      expect(user?.Name).toBe('created');
    });

    it('should create related record in upsert update branch', async () => {
      const profile = await db.profile.create({
        Bio: 'bio',
        user: { create: UserData },
      });

      const updated = await db.profile
        .selectAll()
        .find(profile.Id)
        .upsert({
          update: { user: { create: { ...UserData, Name: 'created' } } },
          create: { ...ProfileData, user: { create: UserData } },
        });

      expect((await db.profile.queryRelated('user', updated))?.Name).toBe(
        'created',
      );
    });

    it('should create new related record using `on` conditions and update foreignKey', async () => {
      const profileId = await db.profile
        .get('Id')
        .create({ Bio: 'bio', user: { create: UserData } });

      resetQueriesCount();

      const updated = await db.profile
        .selectAll()
        .find(profileId)
        .update({
          activeUser: {
            create: { ...UserData, Name: 'created' },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      const user = await db.profile.queryRelated('user', updated);
      expect(user).toMatchObject({ Name: 'created', Active: true });
    });

    it('should create a new related record and update foreignKey in batch update', async () => {
      const UserId = await db.user.get('Id').create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId },
        { ...ProfileData, UserId },
      ]);

      resetQueriesCount();

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } })
        .update({
          user: {
            create: { ...UserData, Name: 'created' },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(updatedUserIds[0]).toBe(updatedUserIds[1]);

      const user = await db.user.find(updatedUserIds[0] as number);
      expect(user.Name).toBe('created');
    });

    it('should create a new related record with `on` conditions and update foreignKey in batch update', async () => {
      const UserId = await db.user.get('Id').create(UserData);
      const profileIds = await db.profile.pluck('Id').createMany([
        { ...ProfileData, UserId },
        { ...ProfileData, UserId },
      ]);

      resetQueriesCount();

      const updatedUserIds = await db.profile
        .pluck('UserId')
        .where({ Id: { in: profileIds } })
        .update({
          activeUser: {
            create: { ...UserData, Name: 'created' },
          },
        });

      expect(getQueriesCount()).toEqual(1);

      expect(updatedUserIds[0]).toBe(updatedUserIds[1]);

      const user = await db.user.find(updatedUserIds[0] as number);
      expect(user).toMatchObject({ Name: 'created', Active: true });
    });

    describe('relation callbacks', () => {
      const { beforeCreate, afterCreate, resetMocks } = useRelationCallback(
        db.profile.relations.user,
        ['Id'],
      );

      const data = {
        user: {
          create: UserData,
        },
      };

      it('should invoke callbacks', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        const Id = await db.profile
          .get('Id')
          .create({ ...ProfileData, UserId });

        resetQueriesCount();

        const count = await db.profile.find(Id).update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(count).toBe(1);
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ Id: expect.any(Number), UserKey: 'key' }],
          expect.any(Db),
        );
      });

      it('should invoke callbacks in a batch update', async () => {
        const UserId = await db.user.get('Id').create(UserData);
        const ids = await db.profile.pluck('Id').createMany([
          { ...ProfileData, UserId },
          { ...ProfileData, UserId },
        ]);

        resetMocks();

        resetQueriesCount();

        const count = await db.profile.where({ Id: { in: ids } }).update(data);

        expect(getQueriesCount()).toEqual(1);

        expect(count).toBe(2);
        expect(beforeCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledTimes(1);
        expect(afterCreate).toHaveBeenCalledWith(
          [{ Id: expect.any(Number), UserKey: 'key' }],
          expect.any(Db),
        );
      });
    });
  });
});
