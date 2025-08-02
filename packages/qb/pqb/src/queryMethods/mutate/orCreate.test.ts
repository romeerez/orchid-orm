import { User, userData } from '../../test-utils/test-utils';
import { assertType, sql, testDb, useTestDatabase } from 'test-utils';
import { TransactionAdapter } from '../../adapter';
import { QueryInput } from 'orchid-core';

const TableWithReadOnly = testDb('user', (t) => ({
  id: t.identity().primaryKey(),
  name: t.string(),
  password: t.integer().readOnly(),
}));

const emulateReturnNoRowsOnce = () => {
  // emulate the edge case when first query doesn't find the record, and then in CTE it appears
  const { query } = TransactionAdapter.prototype;
  TransactionAdapter.prototype.query = async function (
    this: unknown,
    q: QueryInput,
  ) {
    const result = await query.call(this, q);
    result.rowCount = 0;
    TransactionAdapter.prototype.query = query;
    return result;
  } as never;
};

describe('orCreate', () => {
  useTestDatabase();

  it('should not allow using appReadOnly columns in create', async () => {
    await expect(() =>
      TableWithReadOnly.find(1).orCreate({
        name: 'name',
        // @ts-expect-error password is readOnly
        password: 'password',
      }),
    ).rejects.toThrow('Trying to insert a readonly column');
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

    expect(user).toMatchObject({ name: 'created', age: 28 });
  });

  it('should create record if not exists with data from a callback', async () => {
    const user = await User.selectAll()
      .find(123)
      .orCreate(() => ({
        ...userData,
        name: 'created',
      }));

    expect(user.name).toBe('created');
  });

  it('should not call after create hooks when not created, should return void by default', async () => {
    await User.create(userData);

    const afterCreate = jest.fn();
    const afterCreateCommit = jest.fn();

    emulateReturnNoRowsOnce();

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
