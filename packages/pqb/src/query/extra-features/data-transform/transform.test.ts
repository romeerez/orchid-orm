import {
  assertType,
  db,
  testDb,
  useTestDatabase,
  UserData,
  UserDefaultSelect,
} from 'test-utils';

describe('transform', () => {
  useTestDatabase();

  describe('without data', () => {
    it('should transform a not found record', async () => {
      const result = await db.user.findOptional(0).transform((record) => {
        assertType<typeof record, UserDefaultSelect | undefined>();
        return 123;
      });

      assertType<typeof result, number>();

      expect(result).toBe(123);
    });

    it('should transform a not found record in a sub query', async () => {
      await db.user.insert(UserData);

      const record = await db.user.take().select({
        sub: () =>
          db.user.findOptional(0).transform((record) => {
            assertType<typeof record, UserDefaultSelect | undefined>();
            return 123;
          }),
      });

      assertType<typeof record, { sub: number }>();

      expect(record).toEqual({ sub: 123 });
    });

    it('should transform null for an aggregate', async () => {
      const sum = await db.user.sum('Age').transform((sum) => {
        assertType<typeof sum, string | null>();
        return 0;
      });

      assertType<typeof sum, number>();

      expect(sum).toBe(0);
    });

    it('should transform null for an aggregate in a sub query', async () => {
      await db.user.insert(UserData);

      const sum = await db.user.select({
        sum: () =>
          db.user.sum('Age').transform((sum) => {
            assertType<typeof sum, string | null>();
            return 0;
          }),
      });

      assertType<typeof sum, { sum: number }[]>();

      expect(sum).toEqual([{ sum: 0 }]);
    });

    describe('none', () => {
      it('should transform many records with none()', async () => {
        const res = await db.user.none().transform((data) => ({ data }));

        assertType<typeof res, { data: UserDefaultSelect[] }>();

        expect(res).toEqual({ data: [] });
      });

      it('should transform single record with none()', async () => {
        const res = await db.user
          .takeOptional()
          .none()
          .transform((record) => ({ record: !!record }));

        assertType<typeof res, { record: boolean }>();

        expect(res).toEqual({ record: false });
      });

      it('should transform a value with none()', async () => {
        const res = await db.user
          .getOptional('Name')
          .none()
          .transform((value) => ({ value: !!value }));

        assertType<typeof res, { value: boolean }>();

        expect(res).toEqual({ value: false });
      });
    });
  });

  describe('with data', () => {
    const age = 10;
    let userId: number | undefined;
    beforeAll(async () => {
      userId = await db.user.insert({ ...UserData, Age: age }).get('Id');
    });

    it('should transform nested get', async () => {
      const res = await db.user.get(() =>
        db.user.get('createdAt').transform((val) => ({ val })),
      );

      expect(res).toEqual({ val: expect.any(Date) });
    });

    it('should load and transform records, with respect to column parsers', async () => {
      const q = db.user.select('Name', 'createdAt').transform((nodes) => ({
        nodes,
        cursor: 1,
      }));

      assertType<
        Awaited<typeof q>,
        { nodes: { Name: string; createdAt: Date }[]; cursor: number }
      >();

      const res = await q;
      expect(res).toEqual({
        nodes: [{ Name: UserData.Name, createdAt: expect.any(Date) }],
        cursor: 1,
      });
    });

    it('should load and transform records from a sub-query, with respect to column parsers', async () => {
      const q = db.user.select('Id', {
        users: () =>
          db.user
            .select('Name', 'createdAt')
            .take()
            .transform((nodes) => ({
              nodes,
              cursor: 1,
            })),
      });

      assertType<
        Awaited<typeof q>,
        {
          Id: number;
          users: {
            nodes: { Name: string; createdAt: Date };
            cursor: number;
          };
        }[]
      >();

      const res = await q;
      expect(res).toEqual([
        {
          Id: expect.any(Number),
          users: {
            nodes: {
              Name: UserData.Name,
              createdAt: expect.any(Date),
            },
            cursor: 1,
          },
        },
      ]);
    });

    it('should transform relation that does not have parsers', async () => {
      const User = testDb(
        'user',
        (t) => ({
          id: t.identity().primaryKey(),
          name: t.text(),
          password: t.text(),
        }),
        undefined,
        { schema: () => 'schema' },
      );

      const q = User.select('id', {
        users: () =>
          User.select('name', 'password')
            .take()
            .transform((nodes) => ({
              nodes,
              cursor: 1,
            })),
      });

      assertType<
        Awaited<typeof q>,
        {
          id: number;
          users: {
            nodes: { name: string; password: string };
            cursor: number;
          };
        }[]
      >();

      const res = await q;
      expect(res).toEqual([
        {
          id: expect.any(Number),
          users: {
            nodes: {
              name: UserData.Name,
              password: UserData.Password,
            },
            cursor: 1,
          },
        },
      ]);
    });

    it('should transform nested aggregated value', async () => {
      const res = await db.user
        .select({
          sum: () => db.user.sum('Age'),
        })
        .transform((x) => x);

      assertType<typeof res, { sum: string | null }[]>();

      expect(res).toEqual([{ sum: `${age}` }]);
    });

    it('should transform aggregated value', async () => {
      const res = await db.user.select({
        sum: () => db.user.sum('Age').transform((x) => x),
      });

      assertType<typeof res, { sum: string | null }[]>();

      expect(res).toEqual([{ sum: `${age}` }]);
    });

    it('should transform a value loaded from the main query table', async () => {
      const data = await db.user.take().select('Id', {
        x: (q) => q.get('Id').transform(() => 'bang'),
      });

      assertType<typeof data, { Id: number; x: string }>();

      expect(data).toEqual({ Id: userId, x: 'bang' });
    });
  });
});
