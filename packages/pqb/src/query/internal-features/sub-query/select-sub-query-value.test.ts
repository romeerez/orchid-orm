import {
  assertType,
  db,
  ProfileData,
  UserData,
  useTestDatabase,
} from 'test-utils';

describe('select-sub-query value', () => {
  useTestDatabase();

  it('get: should return undefined when record is not found', async () => {
    await db.user.insert(UserData);

    const res = await db.user.select({
      sub: () => db.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: undefined }]);
  });

  it('should return null when record is found but the value is null', async () => {
    await db.user.insert({ ...UserData, profile: { create: {} } });

    const res = await db.user.select({
      sub: () => db.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: null }]);
  });

  it('should return undefined when relation is not found', async () => {
    await db.user.insert(UserData);

    const res = await db.user.select({
      sub: (q) => q.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: undefined }]);
  });

  it('should return null when relation is found but the value is null', async () => {
    await db.user.insert({ ...UserData, profile: { create: {} } });

    const res = await db.user.select({
      sub: (q) => q.profile.getOptional('Bio'),
    });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: null }]);
  });

  it('should support ordering by the value', async () => {
    await db.user.insertMany([
      { ...UserData, profile: { create: { ...ProfileData, Bio: 'b' } } },
      { ...UserData, profile: { create: { ...ProfileData, Bio: 'a' } } },
    ]);

    const res = await db.user
      .select({
        sub: (q) => q.profile.getOptional('Bio'),
      })
      .order('sub');

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: 'a' }, { sub: 'b' }]);
  });

  it('should support where by the value from a sub query', async () => {
    await db.user.insertMany([
      { ...UserData, profile: { create: ProfileData } },
    ]);

    const res = await db.user
      .select({
        sub: (q) => q.profile.getOptional('Bio'),
      })
      .where({ sub: 'bio' });

    assertType<typeof res, { sub: string | null | undefined }[]>();
    expect(res).toEqual([{ sub: 'bio' }]);
  });

  it('should support where by the value prefixed with a table from a sub query', async () => {
    await db.user.insertMany([
      { ...UserData, Active: true, profile: { create: {} } },
    ]);

    const res = await db.user
      .select({
        profile: (q) =>
          q.profile.select({
            user: (q) => q.user.getOptional('Active'),
          }),
      })
      .where({ 'profile.user': true });

    assertType<
      typeof res,
      { profile: { user: boolean | null | undefined } }[]
    >();
    expect(res).toEqual([{ profile: { user: true } }]);
  });

  describe('pluck', () => {
    it('should support value query from a callback', async () => {
      await db.user.insertMany([
        {
          ...UserData,
          profile: { create: {} },
        },
        UserData,
      ]);

      const q = db.user.order('Id').pluck((q) => q.profile.get('Bio'));

      const result = await q;

      assertType<typeof result, (string | null)[]>();

      expect(result).toEqual([null, undefined]);
    });

    it('should resolve any aggregations to null, because aggregations always return null', async () => {
      await db.user.insertMany([
        {
          ...UserData,
          profile: { create: {} },
        },
        UserData,
      ]);

      const q = db.user
        .order('Id')
        .pluck((q) => q.profile.stringAgg('Bio', ','));

      const result = await q;

      assertType<typeof result, (string | null)[]>();

      expect(result).toEqual([null, null]);
    });
  });
});
