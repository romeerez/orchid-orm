import {
  assertType,
  BaseTable,
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

    class UserTable extends BaseTable {
      readonly table = 'user';

      override columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
        name: t.text(),
        password: t.text(),
      }));
    }

    class PostTable extends BaseTable {
      readonly table = 'post';

      override columns = this.setColumns((t) => ({
        id: t.serial().primaryKey(),
        userId: t.name('user_id').integer(),
        title: t.text(),
        body: t.text(),
      }));

      relations = {
        user: this.belongsTo(() => UserTable, {
          required: true,
          columns: ['userId'],
          references: ['id'],
        }),
      };
    }

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
});
