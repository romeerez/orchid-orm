import {
  assertType,
  db,
  PostData,
  sql,
  UserData,
  useTestDatabase,
} from 'test-utils';

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
});
