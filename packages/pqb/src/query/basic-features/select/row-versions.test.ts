import {
  assertType,
  db,
  expectSql,
  ProfileData,
  sql,
  testDb,
  UserData,
  UserDefaultSelect,
  useTestDatabase,
} from 'test-utils';

describe('row versions', () => {
  useTestDatabase();

  it('should return old and new values with database names and output aliases', async () => {
    const id = await db.user.get('Id').create(UserData);
    const query = db.user
      .find(id)
      .update({ Name: 'updated' })
      .select('Name', { oldName: 'old.Name', newName: 'new.Name' });

    expectSql(
      query.toSQL(),
      `UPDATE "schema"."user" "User"
       SET "name" = $1, "updated_at" = now()
       WHERE "User"."id" = $2
       RETURNING "User"."name" "Name", "old"."name" "oldName",
         "new"."name" "newName"`,
      ['updated', id],
    );
    assertType<
      Awaited<typeof query>,
      { Name: string; oldName: string; newName: string }
    >();
    expect(await query).toEqual({
      Name: 'updated',
      oldName: UserData.Name,
      newName: 'updated',
    });
  });

  it('should not mutate query', () => {
    const base = db.user.find(1).update({ Name: 'updated' });
    const originalSql = base.toSQL();

    base.select({ oldName: 'old.Name', newName: 'new.Name' }).toSQL();

    expect(base.toSQL()).toEqual(originalSql);
  });

  it('should return old and new rows as nested objects with output aliases', async () => {
    const id = await db.user.get('Id').create(UserData);
    const query = db.userNoTimestamps
      .find(id)
      .update({ Name: 'updated' })
      .select('Name', { fullOld: 'old.*', fullNew: 'new.*' });

    expectSql(
      query.toSQL(),
      `UPDATE "schema"."user" "User" SET "name" = $1
       WHERE "User"."id" = $2
       RETURNING "User"."name" "Name",
         CASE WHEN to_jsonb("old") IS NULL THEN NULL ELSE
           json_build_object('Id', "old"."id", 'Name', "old"."name",
             'Password', "old"."password") END "fullOld",
         CASE WHEN to_jsonb("new") IS NULL THEN NULL ELSE
           json_build_object('Id', "new"."id", 'Name', "new"."name",
             'Password', "new"."password") END "fullNew"`,
      ['updated', id],
    );
    assertType<
      Awaited<typeof query>,
      {
        Name: string;
        fullOld: { Id: number; Name: string; Password: string };
        fullNew: { Id: number; Name: string; Password: string };
      }
    >();
    expect(await query).toEqual({
      Name: 'updated',
      fullOld: { Id: id, Name: UserData.Name, Password: UserData.Password },
      fullNew: { Id: id, Name: 'updated', Password: UserData.Password },
    });
  });

  it('should use old and new as default row object keys and preserve column parsers', async () => {
    const original = await db.user.create({
      ...UserData,
      Age: 10,
      Balance: '12345678901234567890.123456789',
      Data: { name: 'data', tags: ['one'] },
    });
    const query = db.user
      .find(original.Id)
      .update({ Age: 20 })
      .select('old.*', 'new.*');

    assertType<
      Awaited<typeof query>,
      { old: UserDefaultSelect; new: UserDefaultSelect }
    >();
    expect(await query).toEqual({
      old: original,
      new: { ...original, Age: 20, updatedAt: expect.any(Date) },
    });
  });

  it('should preserve many, optional, missing, and rows results', async () => {
    const id = await db.user.get('Id').create({ ...UserData, Age: 10 });
    const query = db.user
      .where({ Id: id })
      .update({ Age: 20 })
      .select('old.Age');
    assertType<Awaited<typeof query>, { Age: number | null }[]>();
    expect(await query.rows()).toEqual([[10]]);
    expect(
      await db.userNoTimestamps
        .where({ Id: id })
        .update({ Name: 'updated' })
        .select('old.*')
        .rows(),
    ).toEqual([[{ Id: id, Name: UserData.Name, Password: UserData.Password }]]);

    const optional = db.user
      .where({ Id: 0 })
      .update({ Name: 'updated' })
      .select('old.Name')
      .takeOptional();
    assertType<Awaited<typeof optional>, { Name: string } | undefined>();
    expect(await optional).toBeUndefined();
    await expect(
      db.user.find(0).update({ Name: 'updated' }).select('old.Name'),
    ).rejects.toThrow('Record is not found');
    expect(
      await db.user.where({ Id: 0 }).update({}).select('old.Name'),
    ).toEqual([]);
  });

  it('should support increment, decrement, updateOrThrow, and updateMany', async () => {
    const id = await db.user.get('Id').create({ ...UserData, Age: 10 });
    expect(
      await db.user.find(id).increment('Age').select({ oldAge: 'old.Age' }),
    ).toEqual({ oldAge: 10 });
    expect(
      await db.user.find(id).decrement('Age').select({ oldAge: 'old.Age' }),
    ).toEqual({ oldAge: 11 });
    expect(
      await db.user.find(id).updateOrThrow({ Age: 12 }).select('old.Age'),
    ).toEqual({ Age: 10 });
    const query = db.user.updateMany([{ Id: id, Age: 13 }]).select({
      oldAge: 'old.Age',
      newAge: 'new.Age',
    });
    assertType<
      Awaited<typeof query>,
      { oldAge: number | null; newAge: number | null }[]
    >();
    expect(await query).toEqual([{ oldAge: 12, newAge: 13 }]);
  });

  it('should preserve parsers, nullable columns, hidden columns, and chained selects', async () => {
    const original = await db.user.create({ ...UserData, Age: 10 });
    const query = db.user
      .find(original.Id)
      .update({ Age: 20, Picture: 'picture' })
      .select('old.Age', 'new.Picture')
      .select({
        oldPicture: 'old.Picture',
        oldTime: 'old.createdAt',
        newAge: 'new.Age',
        password: 'old.Password',
      });

    assertType<
      Awaited<typeof query>,
      {
        Age: number | null;
        Picture: string | null;
        oldPicture: string | null;
        oldTime: Date;
        newAge: number | null;
        password: string;
      }
    >();
    expect(await query).toEqual({
      Age: 10,
      Picture: 'picture',
      oldPicture: null,
      oldTime: original.createdAt,
      newAge: 20,
      password: UserData.Password,
    });
  });

  it('should apply column selectSql to both versions', async () => {
    const table = testDb(
      'user',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text().selectSql((column) => sql`upper(${column})`),
      }),
      undefined,
      { schema: 'schema' },
    );
    const id = await db.user.get('Id').create(UserData);

    expect(
      await table.find(id).update({ name: 'updated' }).select({
        oldName: 'old.name',
        newName: 'new.name',
        fullOld: 'old.*',
        fullNew: 'new.*',
      }),
    ).toEqual({
      oldName: UserData.Name.toUpperCase(),
      newName: 'UPDATED',
      fullOld: { id, name: UserData.Name.toUpperCase() },
      fullNew: { id, name: 'UPDATED' },
    });
  });

  it('should exclude hidden and computed columns from row objects', async () => {
    const table = testDb(
      'user',
      (t) => ({
        id: t.identity().primaryKey(),
        name: t.text(),
        password: t.text().select(false),
      }),
      undefined,
      {
        schema: 'schema',
        computed: (q) => ({
          doubled: sql`${q.column('id')} * 2`.type((t) => t.integer()),
          runtime: q.computeAtRuntime(['id'], ({ id }) => id * 2),
        }),
      },
    );
    const id = await db.user.get('Id').create(UserData);
    const query = table
      .find(id)
      .select('password')
      .update({ name: 'updated' })
      .select({ fullOld: 'old.*', fullNew: 'new.*' });

    assertType<
      Awaited<typeof query>,
      {
        password: string;
        fullOld: { id: number; name: string };
        fullNew: { id: number; name: string };
      }
    >();
    expect(await query).toEqual({
      password: UserData.Password,
      fullOld: { id, name: UserData.Name },
      fullNew: { id, name: 'updated' },
    });
  });

  it('should select row objects with row_to_json when no column needs mapping', async () => {
    const table = testDb('tag', (t) => ({ tag: t.text().primaryKey() }));
    await table.create({ tag: 'before' });
    const query = table
      .find('before')
      .update({ tag: 'after' })
      .select('old.*', 'new.*');

    expectSql(
      query.toSQL(),
      `UPDATE "schema"."tag" SET "tag" = $1 WHERE "tag"."tag" = $2
       RETURNING row_to_json("old".*) "old", row_to_json("new".*) "new"`,
      ['after', 'before'],
    );
    assertType<
      Awaited<typeof query>,
      { old: { tag: string }; new: { tag: string } }
    >();
    expect(await query).toEqual({
      old: { tag: 'before' },
      new: { tag: 'after' },
    });
  });

  it('should keep old values alongside relations loaded after the update', async () => {
    const id = await db.user.get('Id').create({
      ...UserData,
      profile: { create: ProfileData },
    });
    const result = await db.user
      .find(id)
      .update({ Name: 'updated' })
      .select({
        oldName: 'old.Name',
        profile: (q) => q.profile.select('Bio'),
      });

    expect(result).toEqual({
      oldName: UserData.Name,
      profile: { Bio: ProfileData.Bio },
    });
  });

  it('should keep raw SQL references to old and new working alongside row versions', async () => {
    const id = await db.user.get('Id').create({ ...UserData, Age: 10 });
    const query = db.user
      .find(id)
      .update({ Age: 20 })
      .select({
        diff: sql`new.age - old.age`.type((t) => t.integer()),
        oldAge: 'old.Age',
        newAge: 'new.Age',
      });

    expectSql(
      query.toSQL(),
      `UPDATE "schema"."user" "User"
       SET "age" = $1, "updated_at" = now()
       WHERE "User"."id" = $2
       RETURNING new.age - old.age "diff", "old"."age" "oldAge",
         "new"."age" "newAge"`,
      [20, id],
    );
    expect(await query).toEqual({ diff: 10, oldAge: 10, newAge: 20 });
  });

  it('should expose old values and rows through a CTE with their column parsers', async () => {
    const original = await db.user.create({ ...UserData, Age: 10 });
    const query = db.$qb
      .with('updated', () =>
        db.user
          .find(original.Id)
          .update({ Age: 20 })
          .select({ age: 'old.Age', old: 'old.*' }),
      )
      .from('updated');

    assertType<
      Awaited<typeof query>,
      { age: number | null; old: UserDefaultSelect }[]
    >();
    expect(await query).toEqual([{ age: 10, old: original }]);
  });

  it('should return both versions from the current row when the effective SET is empty', async () => {
    const id = await db.user.get('Id').create(UserData);
    const query = db.userNoTimestamps
      .find(id)
      .update({ Name: undefined })
      .select({ oldName: 'old.Name', newName: 'new.Name' });

    expectSql(
      query.toSQL(),
      `SELECT "User"."name" "oldName", "User"."name" "newName"
       FROM "schema"."user" "User" WHERE "User"."id" = $1 LIMIT 1`,
      [id],
    );
    expect(await query).toEqual({
      oldName: UserData.Name,
      newName: UserData.Name,
    });
  });

  it('should return current row objects when the effective SET is empty', async () => {
    const id = await db.user.get('Id').create(UserData);
    const query = db.userNoTimestamps
      .as('u')
      .find(id)
      .update({ Name: undefined })
      .select({ fullOld: 'old.*', fullNew: 'new.*' });

    expectSql(
      query.toSQL(),
      `SELECT
         CASE WHEN to_jsonb("u") IS NULL THEN NULL ELSE
           json_build_object('Id', "u"."id", 'Name', "u"."name",
             'Password', "u"."password") END "fullOld",
         CASE WHEN to_jsonb("u") IS NULL THEN NULL ELSE
           json_build_object('Id', "u"."id", 'Name', "u"."name",
             'Password', "u"."password") END "fullNew"
       FROM "schema"."user" "u" WHERE "u"."id" = $1 LIMIT 1`,
      [id],
    );
    const row = { Id: id, Name: UserData.Name, Password: UserData.Password };
    expect(await query).toEqual({ fullOld: row, fullNew: row });
  });

  it('should use UPDATE when timestamps add an assignment to an empty input', async () => {
    const oldTime = new Date('2000-01-01T00:00:00Z');
    const id = await db.user
      .get('Id')
      .create({ ...UserData, updatedAt: oldTime });
    const query = db.user.find(id).update({}).select({
      oldTime: 'old.updatedAt',
      newTime: 'new.updatedAt',
    });

    const result = await query;
    expect(result.oldTime).toEqual(oldTime);
    expect(result.newTime.getTime()).toBeGreaterThan(oldTime.getTime());
  });

  it('should keep hook columns separate from old values with the same output name', async () => {
    const id = await db.user.get('Id').create(UserData);
    const hook = jest.fn();
    const query = db.user
      .afterUpdate(['Name'], hook)
      .find(id)
      .update({ Name: 'updated' })
      .select('old.Name');

    expect(await query).toEqual({ Name: UserData.Name });
    expect(hook.mock.calls[0][0]).toMatchObject([{ Name: 'updated' }]);
  });

  it('should keep hook and relation keys separate from row objects', async () => {
    const original = await db.user.create({
      ...UserData,
      profile: { create: ProfileData },
    });
    const hook = jest.fn();
    const query = db.user
      .afterUpdate(['Id'], hook)
      .find(original.Id)
      .update({ Name: 'updated' })
      .select({ Id: 'old.*', profile: (q) => q.profile.select('Bio') });

    assertType<
      Awaited<typeof query>,
      { Id: UserDefaultSelect; profile: { Bio: string | null } }
    >();
    expect(await query).toEqual({
      Id: original,
      profile: { Bio: ProfileData.Bio },
    });
    expect(hook.mock.calls[0][0]).toMatchObject([{ Id: original.Id }]);
  });

  it('should preserve a table alias named old', async () => {
    const id = await db.user.get('Id').create(UserData);
    const query = db.user
      .as('old')
      .find(id)
      .update({ Name: 'updated' })
      .select({ currentName: 'old.Name', newName: 'new.Name' });

    expectSql(
      query.toSQL(),
      `UPDATE "schema"."user" "old"
       SET "name" = $1, "updated_at" = now()
       WHERE "old"."id" = $2
       RETURNING "old"."name" "currentName", "new"."name" "newName"`,
      ['updated', id],
    );
    expect(await query).toEqual({ currentName: 'updated', newName: 'updated' });
  });

  it('should preserve joined aliases named old', async () => {
    const id = await db.user.get('Id').create(UserData);
    const otherId = await db.user
      .get('Id')
      .create({ ...UserData, Name: 'other' });
    const query = db.user
      .find(id)
      .updateFrom(
        () => db.user.as('old'),
        (q) => q.where({ 'old.Id': otherId }),
      )
      .set({ Name: 'updated' })
      .select({ joinedName: 'old.Name', newName: 'new.Name' });

    expect(await query).toEqual({ joinedName: 'other', newName: 'updated' });
  });

  it.each(['old', 'new'] as const)(
    'should preserve a joined wildcard alias named %s',
    async (alias) => {
      const original = await db.user.create(UserData);
      const query = db.user
        .find(original.Id)
        .updateFrom(db.userNoTimestamps.as(alias), `${alias}.Id`, 'User.Id')
        .set({ Name: 'updated' })
        .select('Name', { joined: `${alias}.*` as const });

      assertType<
        Awaited<typeof query>,
        {
          Name: string;
          joined: { Id: number; Name: string; Password: string };
        }
      >();
      expect(await query).toEqual({
        Name: 'updated',
        joined: {
          Id: original.Id,
          Name: original.Name,
          Password: UserData.Password,
        },
      });
    },
  );

  it.each([
    ['old', '"__old"', '"new"'],
    ['new', '"old"', '"__new"'],
  ] as const)(
    'should rename only %s when a table with its name is joined after select',
    async (version, oldAs, newAs) => {
      const id = await db.user.get('Id').create(UserData);
      const otherId = await db.user
        .get('Id')
        .create({ ...UserData, Name: 'other' });
      const query = db.user
        .find(id)
        .update({ Name: 'updated' })
        .select({ oldName: 'old.Name', newName: 'new.Name' })
        .updateFrom(
          () => db.user.as(version),
          (q) => q.where({ Id: otherId }),
        );

      expectSql(
        query.toSQL(),
        `UPDATE "schema"."user" "User"
         SET "name" = $1, "updated_at" = now()
         FROM "schema"."user" "${version}"
         WHERE "User"."id" = $3 AND "${version}"."id" = $2
         RETURNING WITH (${version.toUpperCase()} AS "__${version}")
           ${oldAs}."name" "oldName", ${newAs}."name" "newName"`,
        ['updated', otherId, id],
      );
      expect(await query).toEqual({
        oldName: UserData.Name,
        newName: 'updated',
      });
    },
  );

  it.each([
    ['old', UserData.Name],
    ['new', 'updated'],
  ] as const)(
    'should avoid collisions with an internal SQL alias for %s',
    async (version, value) => {
      const id = await db.user.get('Id').create(UserData);
      const otherId = await db.user
        .get('Id')
        .create({ ...UserData, Name: 'other' });
      const query = db.user
        .as(`__${version}`)
        .find(id)
        .update({ Name: 'updated' })
        .select({ value: `${version}.Name` as const })
        .updateFrom(
          () => db.user.as(version),
          (q) => q.where({ Id: otherId }),
        );

      expectSql(
        query.toSQL(),
        `UPDATE "schema"."user" "__${version}"
         SET "name" = $1, "updated_at" = now()
         FROM "schema"."user" "${version}"
         WHERE "__${version}"."id" = $3 AND "${version}"."id" = $2
         RETURNING WITH (${version.toUpperCase()} AS "__${version}2")
           "__${version}2"."name" "value"`,
        ['updated', otherId, id],
      );
      expect(await query).toEqual({ value });
    },
  );

  it('should reject row versions outside of select after UPDATE', () => {
    expect(() => {
      // @ts-expect-error row-version wildcards are only available after UPDATE
      db.user.select({ fullOld: 'old.*' });
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      // @ts-expect-error row versions are only available after UPDATE
      db.user.select('old.Name');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      // @ts-expect-error INSERT does not expose UPDATE row versions
      db.user.create(UserData).select({ name: 'old.Name' });
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      // @ts-expect-error DELETE does not expose UPDATE row versions
      db.user.all().delete().select('new.Name');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      // @ts-expect-error switching to DELETE removes UPDATE row versions
      db.user.all().update({}).delete().select('old.Name');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      // @ts-expect-error switching to INSERT removes UPDATE row versions
      db.user.all().update({}).create(UserData).select('old.Name');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    // types allow switching to DELETE after selecting row versions
    expect(() =>
      db.user.all().update({}).select('old.Name').delete().toSQL(),
    ).toThrow('OLD/NEW columns can only be selected by UPDATE');
    const query = db.user.all().update({ Name: 'updated' });
    // @ts-expect-error row versions must not leak into WHERE
    query.where({ 'old.Name': 'name' });
    // @ts-expect-error row versions must not leak into SET
    query.set({ 'old.Name': 'name' });
    // @ts-expect-error row-version strings are only supported by select
    query.get('old.Name');
    // @ts-expect-error row-version strings are only supported by select
    query.getOptional('new.Name');
    // @ts-expect-error row-version strings are only supported by select
    query.pluck('old.Name');
    // @ts-expect-error row-version wildcards must not leak into WHERE
    query.where({ 'old.*': {} });
    // @ts-expect-error row-version wildcards must not leak into SET
    query.set({ 'new.*': {} });
    // @ts-expect-error row-version wildcards are only supported by select
    query.get('old.*');
    // @ts-expect-error row-version wildcards are only supported by select
    query.getOptional('new.*');
    // @ts-expect-error row-version wildcards are only supported by select
    query.pluck('old.*');
  });

  it('should reject row versions of non-column selectables', () => {
    expect(() => {
      // @ts-expect-error unknown physical column
      db.user.all().update({}).select('old.missing');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      const query = db.user.all().update({ Name: 'updated' });
      // @ts-expect-error relations are not row-version columns
      query.select({ profile: 'old.profile' });
    }).toThrow('OLD/NEW selections require an UPDATE table column');

    const table = testDb(
      'table',
      (t) => ({ id: t.identity().primaryKey() }),
      undefined,
      {
        computed: (q) => ({
          doubled: sql`${q.column('id')} * 2`.type((t) => t.integer()),
          runtime: q.computeAtRuntime(['id'], ({ id }) => id * 2),
        }),
      },
    );
    const query = table.all().update({});
    expect(() => {
      // @ts-expect-error computed SQL is not a physical column
      query.select('old.doubled');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
    expect(() => {
      // @ts-expect-error runtime computations are not row versions
      query.select('new.runtime');
    }).toThrow('OLD/NEW selections require an UPDATE table column');
  });
});
