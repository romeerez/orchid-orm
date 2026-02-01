import { User, userData, UserRecord } from '../../../test-utils/pqb.test-utils';
import { assertType, testDb, useTestDatabase } from 'test-utils';

describe('transform', () => {
  useTestDatabase();

  describe('without data', () => {
    it('should transform a not found record', async () => {
      const result = await User.findOptional(0).transform((record) => {
        assertType<typeof record, UserRecord | undefined>();
        return 123;
      });

      assertType<typeof result, number>();

      expect(result).toBe(123);
    });

    it('should transform a not found record in a sub query', async () => {
      await User.insert(userData);

      const record = await User.take().select({
        sub: () =>
          User.findOptional(0).transform((record) => {
            assertType<typeof record, UserRecord | undefined>();
            return 123;
          }),
      });

      assertType<typeof record, { sub: number }>();

      expect(record).toEqual({ sub: 123 });
    });

    it('should transform null for an aggregate', async () => {
      const sum = await User.sum('age').transform((sum) => {
        assertType<typeof sum, string | null>();
        return 0;
      });

      assertType<typeof sum, number>();

      expect(sum).toBe(0);
    });

    it('should transform null for an aggregate in a sub query', async () => {
      await User.insert(userData);

      const sum = await User.select({
        sum: () =>
          User.sum('age').transform((sum) => {
            assertType<typeof sum, string | null>();
            return 0;
          }),
      });

      assertType<typeof sum, { sum: number }[]>();

      expect(sum).toEqual([{ sum: 0 }]);
    });

    describe('none', () => {
      it('should transform many records with none()', async () => {
        const res = await User.none().transform((data) => ({ data }));

        assertType<typeof res, { data: UserRecord[] }>();

        expect(res).toEqual({ data: [] });
      });

      it('should transform single record with none()', async () => {
        const res = await User.takeOptional()
          .none()
          .transform((record) => ({ record: !!record }));

        assertType<typeof res, { record: boolean }>();

        expect(res).toEqual({ record: false });
      });

      it('should transform a value with none()', async () => {
        const res = await User.getOptional('name')
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
      userId = await User.insert({ ...userData, age }).get('id');
    });

    it('should load and transform records, with respect to column parsers', async () => {
      const q = User.select('name', 'createdAt').transform((nodes) => ({
        nodes,
        cursor: 1,
      }));

      assertType<
        Awaited<typeof q>,
        { nodes: { name: string; createdAt: Date }[]; cursor: number }
      >();

      const res = await q;
      expect(res).toEqual({
        nodes: [{ name: userData.name, createdAt: expect.any(Date) }],
        cursor: 1,
      });
    });

    it('should load and transform records from a sub-query, with respect to column parsers', async () => {
      const q = User.select('id', {
        users: () =>
          User.select('name', 'createdAt')
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
          users: { nodes: { name: string; createdAt: Date }; cursor: number };
        }[]
      >();

      const res = await q;
      expect(res).toEqual([
        {
          id: expect.any(Number),
          users: {
            nodes: {
              name: userData.name,
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
          users: { nodes: { name: string; password: string }; cursor: number };
        }[]
      >();

      const res = await q;
      expect(res).toEqual([
        {
          id: expect.any(Number),
          users: {
            nodes: {
              name: userData.name,
              password: userData.password,
            },
            cursor: 1,
          },
        },
      ]);
    });

    it('should transform nested aggregated value', async () => {
      const res = await User.select({
        sum: () => User.sum('age'),
      }).transform((x) => x);

      assertType<typeof res, { sum: string | null }[]>();

      expect(res).toEqual([{ sum: `${age}` }]);
    });

    it('should transform aggregated value', async () => {
      const res = await User.select({
        sum: () => User.sum('age').transform((x) => x),
      });

      assertType<typeof res, { sum: string | null }[]>();

      expect(res).toEqual([{ sum: `${age}` }]);
    });

    it('should transform a value loaded from the main query table', async () => {
      const data = await User.take().select('id', {
        x: (q) => q.get('id').transform(() => 'bang'),
      });

      assertType<typeof data, { id: number; x: string }>();

      expect(data).toEqual({ id: userId, x: 'bang' });
    });
  });
});
