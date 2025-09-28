import { createBaseTable, orchidORMWithAdapter } from 'orchid-orm';
import { sql, testDb, useTestDatabase } from 'test-utils';
import { userData } from '../test-utils/test-utils';
import { MAX_BINDING_PARAMS } from '../sql/constants';

const BaseTable = createBaseTable({
  snakeCase: true,
});

class UserTable extends BaseTable {
  readonly table = 'user';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
  }));

  relations = {
    posts: this.hasMany(() => PostTable, {
      columns: ['id'],
      references: ['userId'],
    }),
  };
}

class PostTable extends BaseTable {
  readonly table = 'post';
  columns = this.setColumns((t) => ({
    id: t.identity().primaryKey(),
    title: t.string(),
    userId: t.integer(),
    body: t.text(),
  }));

  relations = {
    user: this.belongsTo(() => UserTable, {
      columns: ['userId'],
      references: ['id'],
    }),
  };
}

const db = orchidORMWithAdapter(
  {
    db: testDb,
    log: false,
  },
  {
    post: PostTable,
    user: UserTable,
  },
);

jest.mock('../sql/constants', () => ({
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
      ...userData,
      posts: { create: [{ title: 'title', body: 'body' }] },
    });

    const res = await db.post
      .select({
        user: (q) =>
          q.user.select({
            username: sql<string>`name`,
          }),
      })
      .take();

    expect(res).toEqual({ user: { username: 'name' } });
  });

  describe('delayed relation select', () => {
    it('should work in create', async () => {
      const res = await db.post
        .select({
          user: (q) => q.user.select('name'),
        })
        .insert({
          title: 'post',
          body: 'body',
          user: { create: userData },
        });

      expect(res).toEqual({ user: { name: 'name' } });
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
          title: 'post',
          body: 'body',
          user: { create: userData },
        })
        .select({
          user: (q) => q.user.select('name'),
        });

      expect(transaction).toHaveBeenCalledTimes(1);
    });

    it('should work in update', async () => {
      const user = await db.user.create({
        ...userData,
        posts: { create: [{ title: 'post', body: 'body' }] },
      });

      const res = await db.user
        .find(user.id)
        .select('name', { posts: (q) => q.posts.select('title') })
        .update({
          name: 'new name',
          posts: {
            update: {
              where: { title: 'post' },
              data: { title: 'new title' },
            },
          },
        });

      expect(res).toEqual({
        name: 'new name',
        posts: [{ title: 'new title' }],
      });
    });

    it('should work in find or create when finding', async () => {
      const user = await db.user.create({
        ...userData,
        posts: { create: [{ title: 'post', body: 'body' }] },
      });

      const res = await db.user
        .select('name', { posts: (q) => q.posts.select('title') })
        .find(user.id)
        .orCreate({
          ...userData,
          name: 'created',
        });

      expect(res).toEqual({
        name: 'name',
        posts: [{ title: 'post' }],
      });
    });

    // TODO: once relations can create inside orCreate
    it.todo('should work in find or create when creating');

    it('should work in upsert when updating', async () => {
      const user = await db.user.create({
        ...userData,
        posts: { create: [{ title: 'post', body: 'body' }] },
      });

      const res = await db.user
        .find(user.id)
        .select('name', {
          posts: (q) => q.posts.select('title'),
        })
        .upsert({
          update: {
            name: 'updated',
          },
          create: {
            ...userData,
            name: 'created',
          },
        });

      expect(res).toEqual({
        name: 'updated',
        posts: [{ title: 'post' }],
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
            ...userData,
            posts: { create: [{ title: 'post', body: 'body' }] },
          })
          .select({
            id: (q) => q.posts.select('title'),
          });

        expect(res).toEqual({ id: [{ title: 'post' }] });
      });

      it('should work when inserting multiple', async () => {
        const res = await db.user
          .insertMany([
            {
              ...userData,
              posts: { create: [{ title: 'post 1', body: 'body' }] },
            },
            {
              ...userData,
              posts: { create: [{ title: 'post 2', body: 'body' }] },
            },
          ])
          .select({
            id: (q) => q.posts.select('title'),
          });

        expect(res).toEqual([
          { id: [{ title: 'post 1' }] },
          { id: [{ title: 'post 2' }] },
        ]);
      });

      describe('in a batch', () => {
        it('should work when inserting a batch', async () => {
          setMaxBindingParams(3);

          const q = db.user
            .insertMany([
              {
                ...userData,
                posts: { create: [{ title: 'post 1', body: 'body' }] },
              },
              {
                ...userData,
                posts: { create: [{ title: 'post 2', body: 'body' }] },
              },
            ])
            .select({
              id: (q) => q.posts.select('title'),
            });

          expect(q.toSQL()).toHaveProperty('batch');

          const res = await q;

          expect(res).toEqual([
            { id: [{ title: 'post 1' }] },
            { id: [{ title: 'post 2' }] },
          ]);
        });
      });
    });
  });
});
