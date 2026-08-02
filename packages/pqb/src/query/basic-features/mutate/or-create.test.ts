import { emulateReturnNoRowsOnce } from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  PostData,
  sql,
  testDb,
  UserData,
  UserDefaultSelect,
  useTestDatabase,
} from 'test-utils';
import { TransactionAdapterClass } from '../../../adapters/adapter';

const TableWithReadOnly = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.integer().readOnly(),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

const TableWithSoftDelete = testDb(
  'user',
  (t) => ({
    id: t.identity().primaryKey(),
    name: t.string(),
    password: t.string(),
    deletedAt: t.timestamp().nullable(),
  }),
  undefined,
  {
    schema: () => 'schema',
    softDelete: true,
  },
);

const querySpy = jest.spyOn(TransactionAdapterClass.prototype, 'query');
const arraysSpy = jest.spyOn(TransactionAdapterClass.prototype, 'arrays');

describe('orCreate', () => {
  useTestDatabase();

  it('should not call create callback producing data when the record is found', async () => {
    const fn = jest.fn(() => UserData);
    const id = await db.user.get('Id').insert(UserData);

    await db.user.find(id).orCreate(fn);

    expect(fn).not.toHaveBeenCalled();
  });

  it('should not allow using appReadOnly columns in create', async () => {
    expect(() =>
      TableWithReadOnly.find(1).orCreate({
        name: 'name',
        // @ts-expect-error password is readOnly
        password: 'password',
      }),
    ).toThrow('Trying to insert a readonly column');
  });

  it('should return void by default', () => {
    const query = db.user.find(1).orCreate(UserData);

    assertType<Awaited<typeof query>, void>();
  });

  it('should not create record if exists', async () => {
    const { Id } = await db.user.create(UserData);

    const user = await db.user
      .selectAll()
      .find(Id)
      .orCreate({
        ...UserData,
        Name: 'created',
      });

    assertType<typeof user, UserDefaultSelect>();

    expect(user.Name).toBe(UserData.Name);
  });

  it('should not create record if exists using `get`', async () => {
    const { Id } = await db.user.create(UserData);

    const created = await db.user
      .get('Id')
      .find(Id)
      .orCreate({
        ...UserData,
        Name: 'created',
      });

    assertType<typeof created, number>();

    expect(created).toBe(Id);
  });

  it('should create record if not exists, should support sql and sub queries', async () => {
    const { Id: createdId } = await db.user.create({
      ...UserData,
      Name: 'created',
    });

    const user = await db.user
      .selectAll()
      .find(123)
      .orCreate({
        ...UserData,
        Name: () => db.user.get('Name').where({ Id: createdId }),
        Age: () => sql`28`,
      });

    assertType<typeof user, UserDefaultSelect>();

    expect(user).toMatchObject({ Name: 'created', Age: 28 });
  });

  it('should create record if not exists with data from a callback', async () => {
    const user = await db.user
      .selectAll()
      .find(123)
      .orCreate(() => ({
        ...UserData,
        Name: 'created',
      }));

    assertType<typeof user, UserDefaultSelect>();

    expect(user.Name).toBe('created');
  });

  it('should create hasMany records when creating the record', async () => {
    const user = await db.user
      .select('Id', 'UserKey')
      .find(123)
      .orCreate({
        ...UserData,
        posts: { create: [PostData] },
      });

    const posts = await db.post.select('UserId', 'Title', 'Body');

    expect(posts).toEqual([
      {
        UserId: user.Id,
        Title: user.UserKey,
        Body: PostData.Body,
      },
    ]);
  });

  // FOR UPDATE only makes sense for SELECT queries
  it('should keep FOR UPDATE for the select part, but omit it for the INSERT part', async () => {
    querySpy.mockClear();
    arraysSpy.mockClear();

    await db.user.find(123).orCreate(UserData).forUpdate();

    expect([...querySpy.mock.calls, ...arraysSpy.mock.calls]).toEqual([
      [
        'SELECT FROM "schema"."user" "User" WHERE "User"."id" = $1 FOR UPDATE',
        [123],
        undefined,
      ],
      [
        'WITH "q" AS (' +
          'SELECT FROM "schema"."user" "User" WHERE "User"."id" = $1 FOR UPDATE' +
          '), "q2" AS (' +
          'INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at") SELECT $2, $3, $4, $5, $6 WHERE (NOT EXISTS (SELECT 1 FROM "q")) RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(UserData)],
        undefined,
      ],
    ]);
  });

  it('should omit soft delete check from the insert part, since it was applied in the selecting sub query', async () => {
    querySpy.mockClear();
    arraysSpy.mockClear();

    const softDeleteData = { name: 'name', password: 'password' };
    await TableWithSoftDelete.find(123).orCreate(softDeleteData);

    expect([...querySpy.mock.calls, ...arraysSpy.mock.calls]).toEqual([
      [
        'SELECT FROM "schema"."user" WHERE ("user"."id" = $1) AND ("user"."deleted_at" IS NULL)',
        [123],
      ],
      [
        'WITH "q" AS (' +
          'SELECT FROM "schema"."user" WHERE ("user"."id" = $1) AND ("user"."deleted_at" IS NULL)' +
          '), "q2" AS (' +
          'INSERT INTO "schema"."user"("name", "password") SELECT $2, $3 WHERE (NOT EXISTS (SELECT 1 FROM "q")) RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(softDeleteData)],
        undefined,
      ],
    ]);
  });

  describe('hooks', () => {
    it('should not call after create hooks when not created, should return void by default', async () => {
      const { Id } = await db.user.create(UserData);

      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce('arrays');

      const res = await db.user
        .find(Id)
        .orCreate(UserData)
        .afterCreate(['Password'], afterCreate)
        .afterCreateCommit(['Age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should not call after create hooks when not created, should return only the selected columns', async () => {
      const { Id } = await db.user.create(UserData);

      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await db.user
        .find(Id)
        .select('Id')
        .orCreate(UserData)
        .afterCreate(['Password'], afterCreate)
        .afterCreateCommit(['Age'], afterCreateCommit);

      assertType<typeof res, { Id: number }>();
      expect(res).toEqual({ Id: expect.any(Number) });

      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should call after create hooks when created', async () => {
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      await db.user
        .find(123)
        .orCreate(UserData)
        .afterCreate(['Password'], afterCreate)
        .afterCreateCommit(['Age'], afterCreateCommit);

      expect(afterCreate).toHaveBeenCalledWith(
        [
          {
            Password: 'password',
            Age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterCreateCommit).toHaveBeenCalledWith(
        [
          {
            Password: 'password',
            Age: null,
          },
        ],
        expect.any(Object),
      );
    });
  });

  describe('cte', () => {
    it('should find a record when is nested in select', async () => {
      const id = await db.user.get('Id').insert(UserData);

      const res = await db.user.take().select({
        Id: () => db.user.find(id).get('User.Id').orCreate(UserData),
      });

      expect(res).toEqual({ Id: id });
    });

    it('should create a record when is nested in select', async () => {
      const res = await testDb.qb
        .select({
          Id: () => db.user.find(0).get('Id').orCreate(UserData),
        })
        .take();

      expect(res).toEqual({ Id: expect.any(Number) });
    });
  });
});
