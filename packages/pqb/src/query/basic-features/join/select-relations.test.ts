import {
  assertType,
  defineTable,
  db,
  PostData,
  sql,
  UserData,
  useTestDatabase,
} from 'test-utils';
import { orchidORMWithAdapter } from 'orchid-orm';

const ormParams = {
  db: db.$qb,
  schema: () => 'schema',
};

describe('select relations', () => {
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

  // https://github.com/romeerez/orchid-orm/issues/708
  it('should select a relation when deleting a record', async () => {
    // defining new tables because need to have a **required** relation to provoke the `UNION ALL` that ensures the user exists

    const UserTable = defineTable('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));

    const PostTable = defineTable('post', (t) => ({
      id: t.serial().primaryKey(),
      userId: t.name('user_id').integer(),
      title: t.text(),
      body: t.text(),
    })).relations((post) => ({
      user: post('userId')
        .belongsTo(() => UserTable('id'))
        .required(),
    }));

    const db = orchidORMWithAdapter(ormParams, {
      user: UserTable,
      post: PostTable,
    });

    await db.post.insert({
      title: 'title',
      body: 'body',
      user: { create: { name: 'name', password: 'password' } },
    });

    const res = await db.post
      .all()
      .delete()
      .select('title', {
        user: (q) => q.user.select('name'),
      })
      .take();

    assertType<typeof res, { title: string; user: { name: string } }>();

    expect(res).toEqual({ title: 'title', user: { name: 'name' } });
  });

  // https://github.com/romeerez/orchid-orm/issues/745
  describe('selecting a relation from a query without a FROM (e.g. `$select`)', () => {
    const UserTable = defineTable('user', (t) => ({
      id: t.serial().primaryKey(),
      name: t.text(),
      password: t.text(),
    }));

    const PostTable = defineTable('post', (t) => ({
      id: t.serial().primaryKey(),
      userId: t.name('user_id').integer(),
      title: t.text(),
      body: t.text(),
    })).relations((post) => ({
      user: post('userId').belongsTo(() => UserTable('id')),
    }));

    const local = orchidORMWithAdapter(ormParams, {
      user: UserTable,
      post: PostTable,
    });

    it('should render a `belongsTo` chain as a scalar sub-query', async () => {
      await local.post.insert({
        title: 'title',
        body: 'body',
        user: { create: { name: 'name', password: 'password' } },
      });

      const res = await local.$qb
        .select({
          users: () => local.post.chain('user').select('id', 'name'),
        })
        .take();

      assertType<typeof res, { users: { id: number; name: string }[] }>();

      expect(res.users).toEqual([{ id: expect.any(Number), name: 'name' }]);
    });

    it('should coalesce an empty relation result to `[]`', async () => {
      const res = await local.$qb
        .select({
          users: () => local.post.chain('user').select('id', 'name'),
        })
        .take();

      expect(res.users).toEqual([]);
    });

    it('should render a `hasMany`-like chain (pluck) as a scalar sub-query', async () => {
      await local.post.insertMany([
        {
          title: 'a',
          body: 'body',
          user: { create: { name: 'name', password: 'password' } },
        },
        {
          title: 'b',
          body: 'body',
          user: { create: { name: 'name', password: 'password' } },
        },
      ]);

      const res = await local.$qb
        .select({
          titles: () => local.post.pluck('title'),
        })
        .take();

      assertType<typeof res, { titles: string[] }>();

      expect((res.titles as string[]).sort()).toEqual(['a', 'b']);
    });
  });
});
