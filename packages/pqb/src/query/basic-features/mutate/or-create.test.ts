import {
  emulateReturnNoRowsOnce,
  User,
  userData,
  UserRecord,
} from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  sql,
  testDb,
  TestTransactionAdapter,
  UserData,
  useTestDatabase,
} from 'test-utils';

const TableWithReadOnly = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.integer().readOnly(),
}));

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
    softDelete: true,
  },
);

const arraysSpy = jest.spyOn(TestTransactionAdapter.prototype, 'arrays');

describe('orCreate', () => {
  useTestDatabase();

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
    const { id } = await User.create(userData);

    const user = await User.selectAll()
      .find(id)
      .orCreate({
        ...userData,
        name: 'created',
      });

    assertType<typeof user, UserRecord>();

    expect(user.name).toBe(userData.name);
  });

  it('should not create record if exists using `get`', async () => {
    const { id } = await User.create(userData);

    const created = await User.get('id')
      .find(id)
      .orCreate({
        ...userData,
        name: 'created',
      });

    assertType<typeof created, number>();

    expect(created).toBe(id);
  });

  it('should create record if not exists, should support sql and sub queries', async () => {
    const user = await User.selectAll()
      .find(123)
      .orCreate({
        ...userData,
        name: () => User.create({ ...userData, name: 'created' }).get('name'),
        age: () => sql`28`,
      });

    assertType<typeof user, UserRecord>();

    expect(user).toMatchObject({ name: 'created', age: 28 });
  });

  it('should create record if not exists with data from a callback', async () => {
    const user = await User.selectAll()
      .find(123)
      .orCreate(() => ({
        ...userData,
        name: 'created',
      }));

    assertType<typeof user, UserRecord>();

    expect(user.name).toBe('created');
  });

  // FOR UPDATE only makes sense for SELECT queries
  it('should keep FOR UPDATE for the select part, but omit it for the INSERT part', async () => {
    arraysSpy.mockClear();

    await User.find(123).orCreate(userData).forUpdate();

    expect(arraysSpy.mock.calls).toEqual([
      ['SELECT FROM "user" WHERE "user"."id" = $1 FOR UPDATE', [123]],
      [
        'WITH "q" AS (' +
          'SELECT FROM "user" WHERE "user"."id" = $1 FOR UPDATE' +
          '), "q2" AS (' +
          'INSERT INTO "user"("name", "password") SELECT $2, $3 WHERE (NOT EXISTS (SELECT 1 FROM "q")) RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(userData)],
      ],
    ]);
  });

  it('should omit soft delete check from the insert part, since it was applied in the selecting sub query', async () => {
    arraysSpy.mockClear();

    await TableWithSoftDelete.find(123).orCreate(userData);

    expect(arraysSpy.mock.calls).toEqual([
      [
        'SELECT FROM "user" WHERE ("user"."id" = $1) AND ("user"."deleted_at" IS NULL)',
        [123],
      ],
      [
        'WITH "q" AS (' +
          'SELECT FROM "user" WHERE ("user"."id" = $1) AND ("user"."deleted_at" IS NULL)' +
          '), "q2" AS (' +
          'INSERT INTO "user"("name", "password") SELECT $2, $3 WHERE (NOT EXISTS (SELECT 1 FROM "q")) RETURNING NULL' +
          ') SELECT  FROM "q" UNION ALL SELECT  FROM "q2"',
        [123, ...Object.values(userData)],
      ],
    ]);
  });

  describe('hooks', () => {
    it('should not call after create hooks when not created, should return void by default', async () => {
      await User.create(userData);

      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce('arrays');

      const res = await User.findBy({ name: 'name' })
        .orCreate(userData)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, void>();
      expect(res).toBe(undefined);

      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should not call after create hooks when not created, should return only the selected columns', async () => {
      await User.create(userData);

      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      emulateReturnNoRowsOnce();

      const res = await User.select('id')
        .findBy({ name: 'name' })
        .orCreate(userData)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      assertType<typeof res, { id: number }>();
      expect(res).toEqual({ id: expect.any(Number) });

      expect(afterCreate).not.toHaveBeenCalled();
      expect(afterCreateCommit).not.toHaveBeenCalled();
    });

    it('should call after create hooks when created', async () => {
      const afterCreate = jest.fn();
      const afterCreateCommit = jest.fn();

      await User.findBy({ name: 'name' })
        .orCreate(userData)
        .afterCreate(['password'], afterCreate)
        .afterCreateCommit(['age'], afterCreateCommit);

      expect(afterCreate).toHaveBeenCalledWith(
        [
          {
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
      expect(afterCreateCommit).toHaveBeenCalledWith(
        [
          {
            password: 'password',
            age: null,
          },
        ],
        expect.any(Object),
      );
    });
  });

  describe('cte', () => {
    it('should find a record when is nested in select', async () => {
      const id = await User.get('id').insert(userData);

      const res = await User.take().select({
        id: () => User.get('id').find(id).orCreate(userData),
      });

      expect(res).toEqual({ id });
    });

    it('should create a record when is nested in select', async () => {
      const res = await testDb.qb
        .select({
          id: () => User.get('id').find(0).orCreate(userData),
        })
        .take();

      expect(res).toEqual({ id: expect.any(Number) });
    });
  });
});
