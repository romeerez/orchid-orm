import { NotFoundError, QueryError } from '../../errors';
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

  it('should not execute `orCreate` and `upsert` called before `none`', async () => {
    const result = await Promise.all([
      db.user.find(1).orCreate(UserData).none(),
      db.user.find(1).upsert({ update: {}, create: UserData }).none(),
      db.user.none().find(1).orCreate(UserData).none(),
      db.user.none().find(1).upsert({ update: {}, create: UserData }).none(),
    ]);

    expect(result).toEqual([undefined, undefined, undefined, undefined]);
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

  it('should return 0 for count and null for other aggregates', async () => {
    const result = await Promise.all([
      db.user.none().count(),
      db.user.count().none(),
      db.user.none().sum('Balance'),
      db.user.max('Id').none(),
      db.user.none().boolAnd('Active'),
    ]);

    assertType<
      typeof result,
      [number, number, string | null, number | null, boolean | null]
    >();

    expect(result).toEqual([0, 0, null, null, null]);
    expect(query).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError for a grouped or `having`-filtered aggregate, a window function, and an aggregate compared by an operator', async () => {
    const result = await Promise.allSettled([
      db.user.select('Name').group('Name').none().count(),
      db.user
        .none()
        .having((q) => q.count().gt(0))
        .count(),
      db.user.none().count('*', { over: { partitionBy: 'Name' } }),
      db.user.none().count().gt(0),
    ]);

    expect(result).toEqual([
      { status: 'rejected', reason: expect.any(NotFoundError) },
      { status: 'rejected', reason: expect.any(NotFoundError) },
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

    it('should return 0 for count and null for other aggregates in a sub-select', async () => {
      await db.user.insert(UserData);

      const q = db.user
        .select({
          count: () => db.user.none().count(),
          countThenNone: () => db.user.count().none(),
          sum: () => db.user.none().sum('Balance'),
          relationSum: (q) => q.messages.none().sum('Decimal'),
        })
        .take();

      expectSql(
        q.toSQL(),
        `
          SELECT 0 "count", 0 "countThenNone", null "sum", null "relationSum"
          FROM "schema"."user" "User"
          LEFT JOIN LATERAL (
            SELECT sum("messages"."decimal") "relationSum"
            FROM "schema"."message" "messages"
            WHERE ((false)
              AND "messages"."author_id" = "User"."id"
              AND "messages"."message_key" = "User"."user_key")
              AND ("messages"."deleted_at" IS NULL)
          ) "relationSum" ON true
          LIMIT 1
        `,
      );

      const result = await q;

      assertType<
        typeof result,
        {
          count: number;
          countThenNone: number;
          sum: string | null;
          relationSum: string | null;
        }
      >();

      expect(result).toEqual({
        count: 0,
        countThenNone: 0,
        sum: null,
        relationSum: null,
      });
    });

    it('should return 0 for a count sub-query of `getOptional`', async () => {
      await db.user.insert(UserData);

      const result = await db.user.getOptional(() => db.user.count().none());

      assertType<typeof result, number | undefined>();

      expect(result).toBe(0);
    });

    it('should keep the transaction usable after catching an error of `orCreate`', async () => {
      const id = await db.user.get('Id').insert(UserData);

      await db.$transaction(async () => {
        const err = await db.user
          .none()
          .find(1)
          .orCreate({ ...UserData, Id: id })
          .catch((err) => err);

        expect(err).toBeInstanceOf(QueryError);
        expect(await db.user.count()).toBe(1);
      });
    });
  });
});
