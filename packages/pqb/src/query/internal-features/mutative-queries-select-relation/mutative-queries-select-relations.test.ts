import {
  ChatData,
  db,
  MessageData,
  PostData,
  ProfileData,
  TaskData,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { MAX_BINDING_PARAMS } from '../../sql/sql-constants';
import { NotFoundError } from '../../errors';

jest.mock('../../sql/sql-constants', () => ({
  // Behold the power of JS coercions
  MAX_BINDING_PARAMS: {
    value: 100,
    toString() {
      return this.value;
    },
  },
}));

const setMaxBindingParams = (value: number) => {
  (MAX_BINDING_PARAMS as unknown as { value: number }).value = value;
};

describe('mutative queries select relations', () => {
  useTestDatabase();

  describe('select relation after create', () => {
    it('should work in create (belongsTo)', async () => {
      const res = await db.post
        .select({
          user: (q) => q.user.select('Name'),
        })
        .insert({
          ...PostData,
          user: { create: UserData },
        });

      expect(res).toEqual({ user: { Name: 'name' } });

      // testing in case it created more than selected
      const all = await db.user.select('Name');
      expect(all).toEqual([{ Name: 'name' }]);
    });

    it('should work in create (hasOne)', async () => {
      const res = await db.user
        .select({
          profile: (q) => q.profile.select('Bio'),
        })
        .insert({
          ...UserData,
          profile: { create: ProfileData },
        });

      expect(res).toEqual({ profile: { Bio: ProfileData.Bio } });

      // testing in case it created more than selected
      const all = await db.profile.select('Bio');
      expect(all).toEqual([{ Bio: ProfileData.Bio }]);
    });

    it('should work in create (hasMany)', async () => {
      const res = await db.user
        .select({
          posts: (q) => q.posts.select('Body'),
        })
        .insert({
          ...UserData,
          posts: { create: [PostData] },
        });

      expect(res).toEqual({ posts: [{ Body: PostData.Body }] });

      // testing in case it created more than selected
      const all = await db.post.select('Body');
      expect(all).toEqual([{ Body: PostData.Body }]);
    });

    it('should work in create (hasAndBelongsToMany)', async () => {
      const res = await db.user
        .select({
          chats: (q) => q.chats.select('Title'),
        })
        .insert({
          ...UserData,
          chats: { create: [ChatData] },
        });

      expect(res).toEqual({ chats: [{ Title: ChatData.Title }] });

      // testing in case it created more than selected
      const all = await db.chat.select('Title');
      expect(all).toEqual([{ Title: ChatData.Title }]);
    });

    it('should wrap queries in a transaction', async () => {
      // ignore the test transaction once
      const getStore = jest.spyOn(db.$qb.internal.asyncStorage, 'getStore');
      getStore.mockReturnValueOnce(undefined);

      // spy on transaction method
      const transaction = jest.spyOn(db.post, 'transaction');

      await db.post
        .insert({
          ...PostData,
          user: { create: UserData },
        })
        .select({
          user: (q) => q.user.select('Name'),
        });

      expect(transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('select relation after update', () => {
    it('should work in update (belongsTo)', async () => {
      const post = await db.post.create({
        ...PostData,
        user: { create: UserData },
      });

      const res = await db.post
        .find(post.Id)
        .select({
          user: (q) => q.user.select('Name'),
        })
        .update({
          user: {
            update: {
              Name: 'new name',
            },
          },
        });

      expect(res).toEqual({ user: { Name: 'new name' } });

      const all = await db.user.select('Name');
      expect(all).toEqual([{ Name: 'new name' }]);
    });

    it('should work in update (hasOne)', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const res = await db.user
        .find(user.Id)
        .select({
          profile: (q) => q.profile.select('Bio'),
        })
        .update({
          profile: {
            update: {
              Bio: 'new bio',
            },
          },
        });

      expect(res).toEqual({ profile: { Bio: 'new bio' } });

      const all = await db.profile.select('Bio');
      expect(all).toEqual([{ Bio: 'new bio' }]);
    });

    it('should work in update (hasMany)', async () => {
      const user = await db.user.create({
        ...UserData,
        posts: { create: [PostData] },
      });

      const res = await db.user
        .find(user.Id)
        .select('Name', { posts: (q) => q.posts.select('Body') })
        .update({
          Name: 'new name',
          posts: {
            update: {
              where: { Body: PostData.Body },
              data: { Body: 'new content' },
            },
          },
        });

      expect(res).toEqual({
        Name: 'new name',
        posts: [{ Body: 'new content' }],
      });

      const all = await db.post.select('Body');
      expect(all).toEqual([{ Body: 'new content' }]);
    });

    it('should work in update (hasAndBelongsToMany)', async () => {
      const user = await db.user.create({
        ...UserData,
        chats: { create: [ChatData] },
      });

      const res = await db.user
        .find(user.Id)
        .select({
          chats: (q) => q.chats.select('Title'),
        })
        .update({
          chats: {
            update: {
              where: { Title: ChatData.Title },
              data: { Title: 'new title' },
            },
          },
        });

      expect(res).toEqual({ chats: [{ Title: 'new title' }] });

      const all = await db.chat.select('Title');
      expect(all).toEqual([{ Title: 'new title' }]);
    });
  });

  describe('select relation after orCreate', () => {
    it('should work in find or create when finding (belongsTo)', async () => {
      const post = await db.post.create({
        ...PostData,
        user: { create: UserData },
      });

      const res = await db.post
        .select({ user: (q) => q.user.select('Name') })
        .find(post.Id)
        .orCreate({
          ...PostData,
          Title: 'created',
        });

      expect(res).toEqual({ user: { Name: 'name' } });

      const all = await db.user.select('Name');
      expect(all).toEqual([{ Name: 'name' }]);
    });

    it('should work in find or create when finding (hasOne)', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const res = await db.user
        .select({ profile: (q) => q.profile.select('Bio') })
        .find(user.Id)
        .orCreate({
          ...UserData,
          Name: 'created',
        });

      expect(res).toEqual({ profile: { Bio: ProfileData.Bio } });

      const all = await db.profile.select('Bio');
      expect(all).toEqual([{ Bio: ProfileData.Bio }]);
    });

    it('should work in find or create when finding (hasMany)', async () => {
      const user = await db.user.create({
        ...UserData,
        posts: { create: [PostData] },
      });

      const res = await db.user
        .select('Name', { posts: (q) => q.posts.select('Body') })
        .find(user.Id)
        .orCreate({
          ...UserData,
          Name: 'created',
        });

      expect(res).toEqual({
        Name: 'name',
        posts: [{ Body: PostData.Body }],
      });

      const all = await db.post.select('Body');
      expect(all).toEqual([{ Body: PostData.Body }]);
    });

    it('should work in find or create when finding (hasAndBelongsToMany)', async () => {
      const user = await db.user.create({
        ...UserData,
        chats: { create: [ChatData] },
      });

      const res = await db.user
        .select({ chats: (q) => q.chats.select('Title') })
        .find(user.Id)
        .orCreate({
          ...UserData,
          Name: 'created',
        });

      expect(res).toEqual({ chats: [{ Title: ChatData.Title }] });

      const all = await db.chat.select('Title');
      expect(all).toEqual([{ Title: ChatData.Title }]);
    });
  });

  // TODO: once relations can create inside orCreate
  it.todo('should work in find or create when creating');

  describe('select relation after upsert (when updating)', () => {
    it('should work in upsert when updating (belongsTo)', async () => {
      const post = await db.post.create({
        ...PostData,
        user: { create: UserData },
      });

      const res = await db.post
        .find(post.Id)
        .select({
          user: (q) => q.user.select('Name'),
        })
        .upsert({
          update: {
            Body: 'updated',
          },
          create: {
            ...PostData,
            Body: 'created',
          },
        });

      expect(res).toEqual({
        user: { Name: 'name' },
      });

      const all = await db.user.select('Name');
      expect(all).toEqual([{ Name: 'name' }]);
    });

    it('should work in upsert when updating (hasOne)', async () => {
      const user = await db.user.create({
        ...UserData,
        profile: { create: ProfileData },
      });

      const res = await db.user
        .find(user.Id)
        .select({
          profile: (q) => q.profile.select('Bio'),
        })
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            Name: 'created',
          },
        });

      expect(res).toEqual({
        profile: { Bio: ProfileData.Bio },
      });

      const all = await db.profile.select('Bio');
      expect(all).toEqual([{ Bio: ProfileData.Bio }]);
    });

    it('should work in upsert when updating (hasMany)', async () => {
      const user = await db.user.create({
        ...UserData,
        posts: { create: [PostData] },
      });

      const res = await db.user
        .find(user.Id)
        .select('Name', {
          posts: (q) => q.posts.select('Body'),
        })
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            Name: 'created',
          },
        });

      expect(res).toEqual({
        Name: 'updated',
        posts: [{ Body: PostData.Body }],
      });

      const all = await db.post.select('Body');
      expect(all).toEqual([{ Body: PostData.Body }]);
    });

    it('should work in upsert when updating (hasAndBelongsToMany)', async () => {
      const user = await db.user.create({
        ...UserData,
        chats: { create: [ChatData] },
      });

      const res = await db.user
        .find(user.Id)
        .select({
          chats: (q) => q.chats.select('Title'),
        })
        .upsert({
          update: {
            Name: 'updated',
          },
          create: {
            ...UserData,
            Name: 'created',
          },
        });

      expect(res).toEqual({
        chats: [{ Title: ChatData.Title }],
      });

      const all = await db.chat.select('Title');
      expect(all).toEqual([{ Title: ChatData.Title }]);
    });
  });

  // TODO: once relations can create inside upsert
  it.todo('should work in upsert when creating');

  describe('delete', () => {
    describe('should work in delete', () => {
      it('belongsTo', async () => {
        const post = await db.post.create({
          Title: 'post',
          Body: 'body',
          user: { create: UserData },
        });

        const res = await db.post
          .find(post.Id)
          .delete()
          .select({ Id: (q) => q.user.select('Name', 'updatedAt').take() });

        expect(res).toEqual({
          Id: {
            updatedAt: expect.any(Date),
            Name: UserData.Name,
          },
        });

        const all = await db.post.select('Title');
        expect(all).toEqual([]);
      });

      it('hasOne', async () => {
        const user = await db.user.create({
          ...UserData,
          profileNoFkey: { create: ProfileData },
        });

        const res = await db.user
          .log(true)
          .find(user.Id)
          .delete()
          .select({ Id: (q) => q.profileNoFkey.select('Bio').take() });

        expect(res).toEqual({
          Id: { Bio: ProfileData.Bio },
        });

        const all = await db.user.select('Name');
        expect(all).toEqual([]);
      });

      it('hasMany', async () => {
        const user = await db.user.create({
          ...UserData,
          postsNoFkey: { create: [PostData] },
        });

        const res = await db.user
          .log(true)
          .find(user.Id)
          .delete()
          .select({ Id: (q) => q.postsNoFkey.select('Body') });

        expect(res).toEqual({
          Id: [{ Body: PostData.Body }],
        });

        const all = await db.user.select('Name');
        expect(all).toEqual([]);
      });

      it('(hasAndBelongsToMany)', async () => {
        const user = await db.user.create({
          ...UserData,
          tasks: { create: [TaskData] },
        });

        const res = await db.user
          .find(user.Id)
          .delete()
          .select({ Id: (q) => q.tasks.select('Title') });

        expect(res).toEqual({
          Id: [{ Title: TaskData.Title }],
        });

        const all = await db.user.select('Name');
        expect(all).toEqual([]);
      });
    });

    describe('should not delete if related required record is not found', () => {
      it('belongsTo', async () => {
        const post = await db.post.create({
          Title: 'post',
          Body: 'body',
          user: { create: UserData },
        });

        const q = db.post
          .find(post.Id)
          .delete()
          .select({
            Id: (q) =>
              q.user.where({ Id: 0 }).select('Name', 'updatedAt').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadPost = await db.post.findOptional(post.Id);
        expect(reloadPost).toEqual(post);

        const all = await db.post.select('Title');
        expect(all.length).toBe(1);
      });

      it('hasOne', async () => {
        const user = await db.user.create({
          ...UserData,
          profile: { create: ProfileData },
        });

        const q = db.user
          .find(user.Id)
          .delete()
          .select({
            Id: (q) => q.profile.where({ Bio: 'none' }).select('Bio').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadObject = await db.user.findOptional(user.Id);
        expect(reloadObject).toEqual(user);

        const all = await db.user.select('Name');
        expect(all.length).toBe(1);
      });

      it('hasMany', async () => {
        const user = await db.user.create({
          ...UserData,
          posts: { create: [PostData] },
        });

        const q = db.user
          .find(user.Id)
          .delete()
          .select({
            Id: (q) => q.posts.where({ Body: 'none' }).select('Body').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadObject = await db.user.findOptional(user.Id);
        expect(reloadObject).toEqual(user);

        const all = await db.user.select('Name');
        expect(all.length).toBe(1);
      });

      it('hasAndBelongsToMany', async () => {
        const user = await db.user.create({
          ...UserData,
          chats: { create: [ChatData] },
        });

        const q = db.user
          .find(user.Id)
          .delete()
          .select({
            Id: (q) => q.chats.where({ Title: 'none' }).select('Title').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadObject = await db.user.findOptional(user.Id);
        expect(reloadObject).toEqual(user);

        const all = await db.user.select('Name');
        expect(all.length).toBe(1);
      });
    });

    describe('should work in soft delete: it includes deleted records of the main table to query relations after soft deleting it', () => {
      it('belongsTo', async () => {
        const message = await db.message.create({
          ...MessageData,
          chat: { create: ChatData },
          sender: { create: UserData },
        });

        const res = await db.message
          .find(message.Id)
          .delete()
          .select({
            Id: (q) => q.sender.select('Name', 'updatedAt').take(),
          });

        expect(res).toEqual({
          Id: {
            updatedAt: expect.any(Date),
            Name: UserData.Name,
          },
        });

        const all = await db.message.select('Text');
        expect(all).toEqual([]);
      });

      it('hasOne', async () => {
        const message = await db.message.create({
          ...MessageData,
          chat: { create: ChatData },
          sender: { create: { ...UserData, profile: { create: ProfileData } } },
        });

        const res = await db.message
          .find(message.Id)
          .delete()
          .select({
            Id: (q) => q.profile.select('Bio').take(),
          });

        expect(res).toEqual({
          Id: { Bio: ProfileData.Bio },
        });

        const all = await db.message.select('Text');
        expect(all).toEqual([]);
      });

      it('hasMany', async () => {
        const message = await db.message.create({
          ...MessageData,
          chat: { create: ChatData },
          sender: { create: { ...UserData, profile: { create: ProfileData } } },
        });

        const res = await db.message
          .find(message.Id)
          .delete()
          .select({
            Id: (q) => q.profiles.select('Bio'),
          });

        expect(res).toEqual({
          Id: [{ Bio: ProfileData.Bio }],
        });

        const all = await db.message.select('Text');
        expect(all).toEqual([]);
      });

      it('hasAndBelongsToMany', async () => {
        const user = await db.user.create({
          ...UserData,
          tasks: { create: [TaskData] },
        });

        const res = await db.user
          .find(user.Id)
          .delete()
          .select({
            Id: (q) => q.tasks.select('Title'),
          });

        expect(res).toEqual({
          Id: [{ Title: TaskData.Title }],
        });

        const all = await db.user.select('Name');
        expect(all).toEqual([]);
      });
    });

    describe('should work in soft delete if not found', () => {
      it('belongsTo', async () => {
        const message = await db.message.create({
          ...MessageData,
          chat: { create: ChatData },
          sender: { create: UserData },
        });

        const q = db.message
          .find(message.Id)
          .delete()
          .select({
            Id: (q) =>
              q.sender.where({ Id: 0 }).select('Name', 'updatedAt').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadedMessage = await db.message.findOptional(message.Id);
        expect(reloadedMessage).toEqual(message);

        const all = await db.message.select('Text');
        expect(all.length).toBe(1);
      });

      it('hasOne', async () => {
        const message = await db.message.create({
          ...MessageData,
          chat: { create: ChatData },
          sender: { create: { ...UserData, profile: { create: ProfileData } } },
        });

        const q = db.message
          .find(message.Id)
          .delete()
          .select({
            Id: (q) => q.profile.where({ Bio: 'none' }).select('Bio').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadedMessage = await db.message.findOptional(message.Id);
        expect(reloadedMessage).toEqual(message);

        const all = await db.message.select('Text');
        expect(all.length).toBe(1);
      });

      it('hasMany', async () => {
        const message = await db.message.create({
          ...MessageData,
          chat: { create: ChatData },
          sender: { create: { ...UserData, profile: { create: ProfileData } } },
        });

        const q = db.message
          .find(message.Id)
          .delete()
          .select({
            Id: (q) => q.profiles.where({ Bio: 'none' }).select('Bio').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadedMessage = await db.message.findOptional(message.Id);
        expect(reloadedMessage).toEqual(message);

        const all = await db.message.select('Text');
        expect(all.length).toBe(1);
      });

      it('hasAndBelongsToMany', async () => {
        const user = await db.user.create({
          ...UserData,
          tasks: { create: [TaskData] },
        });

        const q = db.user
          .find(user.Id)
          .delete()
          .select({
            Id: (q) => q.tasks.where({ Title: 'none' }).select('Title').take(),
          });

        const err = await q.catch((err) => err);
        expect(err).toBeInstanceOf(NotFoundError);

        const reloadedUser = await db.user.findOptional(user.Id);
        expect(reloadedUser).toEqual(user);

        const all = await db.user.select('Name');
        expect(all.length).toBe(1);
      });
    });
  });

  describe('loading relation under the same key as a primary key', () => {
    it('should work in a single insert', async () => {
      const res = await db.user
        .insert({
          ...UserData,
          posts: { create: [PostData] },
        })
        .select({
          Id: (q) => q.posts.select('Body'),
        });

      expect(res).toEqual({ Id: [{ Body: PostData.Body }] });
    });

    it('should work when inserting multiple', async () => {
      const res = await db.user
        .insertMany([
          {
            ...UserData,
            posts: { create: [{ Body: 'post 1' }] },
          },
          {
            ...UserData,
            posts: { create: [{ Body: 'post 2' }] },
          },
        ])
        .select({
          Id: (q) => q.posts.select('Body'),
        });

      expect(res).toEqual([
        { Id: [{ Body: 'post 1' }] },
        { Id: [{ Body: 'post 2' }] },
      ]);
    });

    describe('in a batch', () => {
      it('should work when inserting a batch', async () => {
        setMaxBindingParams(5);

        // Nested creates in a single query aren't supported together with the batch mode,
        // it's too complex to support them together.
        db.$qb.internal.nestedCreateBatchMax = 0;

        const q = db.user
          .insertMany([
            {
              ...UserData,
              posts: { create: [{ Body: 'post 1' }] },
            },
            {
              ...UserData,
              posts: { create: [{ Body: 'post 2' }] },
            },
          ])
          .select({
            Id: (q) => q.posts.select('Body'),
          });

        expect(q.toSQL()).toHaveProperty('batch');

        const res = await q;

        expect(res).toEqual([
          { Id: [{ Body: 'post 1' }] },
          { Id: [{ Body: 'post 2' }] },
        ]);
      });
    });
  });
});
