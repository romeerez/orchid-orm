import {
  assertType,
  db,
  PostData,
  sql,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { MAX_BINDING_PARAMS } from '../../sql/constants';

jest.mock('../../sql/constants', () => ({
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

describe('relation-select', () => {
  useTestDatabase();

  // https://github.com/romeerez/orchid-orm/issues/566
  it('should handle nested sub select of sql', async () => {
    await db.user.insert({
      ...UserData,
      posts: { create: [PostData] },
    });

    const res = await db.post
      .select({
        user: (q) =>
          q.user.select({
            username: sql<string>`name`,
          }),
      })
      .take();

    assertType<typeof res, { user: { username: string } | undefined }>();

    expect(res).toEqual({ user: { username: 'name' } });
  });

  // https://github.com/romeerez/orchid-orm/issues/565
  it('should handle nested select of `get`', async () => {
    await db.user.insert({
      ...UserData,
      posts: { create: [PostData] },
    });

    const res = await db.post
      .select({
        user: (q) =>
          q.user.select({
            username: (q) => q.get('Name'),
          }),
      })
      .take();

    assertType<typeof res, { user: { username: string } | undefined }>();

    expect(res).toEqual({ user: { username: 'name' } });
  });

  describe('delayed relation select', () => {
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
      const getStore = jest.spyOn(
        db.$qb.internal.transactionStorage,
        'getStore',
      );
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

    // TODO:
    it.todo('should work in delete');
    // it.only('should work in delete', async () => {
    //   const post = await db.post.create({
    //     title: 'post',
    //     body: 'body',
    //     user: { create: userData },
    //   });
    //
    //   const q = db.post
    //     .find(post.id)
    //     .delete()
    //     .select({ user: (q) => q.user });
    //
    //   console.log(q.toSQL());
    // });

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
});
