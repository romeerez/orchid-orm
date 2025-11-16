import {
  emulateReturnNoRowsOnce,
  User,
  userData,
  UserRecord,
} from '../../test-utils/test-utils';
import { assertType, sql, testDb, useTestDatabase } from 'test-utils';

const TableWithReadOnly = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.integer().readOnly(),
}));

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
    const query = User.find(1).orCreate(userData);

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
