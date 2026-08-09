import { NotFoundError } from '../../errors';
import {
  assertType,
  db,
  useTestDatabase,
  UserData,
  UserDefaultSelect,
  expectSql,
} from 'test-utils';
import { AdapterClass } from '../../../adapters/adapter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = jest.fn<any, any>(() => Promise.resolve({ rows: [] }));
AdapterClass.prototype.query = query;
AdapterClass.prototype.arrays = query;

describe('none', () => {
  test('mock is set up correctly', async () => {
    await db.user;
    expect(query).toHaveBeenCalled();
    query.mockClear();
  });

  it('should be supported in `.where`', async () => {
    const q = db.user.select('Id').where((q) => q.none());

    expectSql(
      q.toSQL(),
      `
        SELECT "User"."id" "Id"
        FROM "schema"."user" "User"
        WHERE ((false))
      `,
    );
  });

  it('should return empty array for return types `all`, `rows`, `pluck`', async () => {
    const result = await Promise.all([
      db.user.none(),
      db.user.all().none(),
      db.user.rows().none(),
      db.user.pluck('Id').none(),
    ]);

    expect(result).toEqual([[], [], [], []]);
    expect(query).not.toHaveBeenCalled();
  });

  it('should return undefined for return types `one`, `value`, `void`', async () => {
    const result = await Promise.all([
      db.user.takeOptional().none(),
      db.user.getOptional('Id').none(),
      db.user.exec().none(),
    ]);

    expect(result).toEqual([undefined, undefined, undefined]);
    expect(query).not.toHaveBeenCalled();
  });

  it('should return 0 for return type `rowCount`', async () => {
    const result = await Promise.all([
      db.user.insert(UserData).none(),
      db.user.all().update({}).none(),
      db.user.all().delete().none(),
    ]);

    expect(result).toEqual([0, 0, 0]);
    expect(query).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError for return types `oneOrThrow`, `valueOrThrow`', async () => {
    const result = await Promise.allSettled([
      db.user.take().none(),
      db.user.get('Id').none(),
    ]);

    expect(result).toEqual([
      { status: 'rejected', reason: expect.any(NotFoundError) },
      { status: 'rejected', reason: expect.any(NotFoundError) },
    ]);
    expect(query).not.toHaveBeenCalled();
  });

  it('should return false for exists', async () => {
    const result = await db.user.none().exists();

    assertType<typeof result, boolean>();

    expect(result).toBe(false);
  });

  it('should return result in `then`', async () => {
    const res = await db.user.none().then((res) => ({ res }));

    assertType<typeof res, { res: UserDefaultSelect[] }>();

    expect(res).toEqual({ res: [] });
  });

  it('supports catch argument in `then`', async () => {
    const err = new Error();

    const res = await db.user
      .none()
      .transform(() => {
        throw err;
      })
      .then(
        () => null,
        (err) => ({ err }),
      );

    expect(res).toEqual({ err });
  });

  it('supports `catch`', async () => {
    const err = new Error();

    const res = await db.user
      .none()
      .transform(() => {
        throw err;
      })
      .catch((err) => ({ err }));

    expect(res).toEqual({ err });
  });

  describe('with db', () => {
    useTestDatabase();

    it('should return false for exists in a sub-select', async () => {
      await db.user.insert(UserData);

      const result = await db.user
        .select({
          exists: () => db.user.none().exists(),
        })
        .take();

      assertType<typeof result, { exists: boolean }>();

      expect(result).toEqual({ exists: false });
    });
  });
});
