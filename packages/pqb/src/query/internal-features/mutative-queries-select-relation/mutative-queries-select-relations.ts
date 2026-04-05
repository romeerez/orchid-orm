import {
  assertType,
  ChatData,
  db,
  MessageData,
  PostData,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { MAX_BINDING_PARAMS } from '../../sql/sql-constants';
import { NotFoundError } from 'pqb';

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

  it('should work in create', async () => {
    const res = await db.post
      .select({
        user: (q) => q.user.select('Name'),
      })
      .insert({
        ...PostData,
        user: { create: UserData },
      });

    expect(res).toEqual({ user: { Name: 'name' } });
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

  it('should work in update', async () => {
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
  });

  it('should work in find or create when finding', async () => {
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
  });

  // TODO: once relations can create inside orCreate
  it.todo('should work in find or create when creating');

  it('should work in upsert when updating', async () => {
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
  });

  // TODO: once relations can create inside upsert
  it.todo('should work in upsert when creating');

  describe('delete', () => {
    it('should work in delete', async () => {
      const post = await db.post.create({
        Title: 'post',
        Body: 'body',
        user: { create: UserData },
      });

      const q = db.post
        .find(post.Id)
        .delete()
        .select({ Id: (q) => q.user.select('Name', 'updatedAt').take() });

      const res = await q;
      assertType<typeof res, { Id: { updatedAt: Date; Name: string } }>();

      expect(res).toEqual({
        Id: {
          updatedAt: expect.any(Date),
          Name: UserData.Name,
        },
      });
    });

    it('should not delete if related required record is not found', async () => {
      const post = await db.post.create({
        Title: 'post',
        Body: 'body',
        user: { create: UserData },
      });

      const q = db.post
        .find(post.Id)
        .delete()
        .select({
          Id: (q) => q.user.where({ Id: 0 }).select('Name', 'updatedAt').take(),
        });

      const err = await q.catch((err) => err);
      expect(err).toBeInstanceOf(NotFoundError);

      assertType<
        Awaited<typeof q>,
        { Id: { updatedAt: Date; Name: string } }
      >();

      const reloadPost = await db.post.findOptional(post.Id);
      expect(reloadPost).toEqual(post);
    });

    it('should work in soft delete: it includes deleted records of the main table to query relations after soft deleting it', async () => {
      const message = await db.message.create({
        ...MessageData,
        chat: { create: ChatData },
        sender: { create: UserData },
      });

      const q = db.message
        .find(message.Id)
        .delete()
        .select({
          Id: (q) => q.sender.select('Name', 'updatedAt').take(),
        });

      const res = await q;
      assertType<typeof res, { Id: { updatedAt: Date; Name: string } }>();

      expect(res).toEqual({
        Id: {
          updatedAt: expect.any(Date),
          Name: UserData.Name,
        },
      });
    });

    it('should work in soft delete if not found', async () => {
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

      assertType<
        Awaited<typeof q>,
        { Id: { updatedAt: Date; Name: string } }
      >();

      const reloadedMessage = await db.message.findOptional(message.Id);
      expect(reloadedMessage).toEqual(message);
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
