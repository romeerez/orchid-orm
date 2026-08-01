import {
  assertType,
  db,
  useTestDatabase,
  UserData,
  UserDefaultSelect,
} from 'test-utils';

describe('map', () => {
  useTestDatabase();

  describe('without data', () => {
    it('should ignore a not found record', async () => {
      const record = await db.user.findOptional(0).map((record) => {
        assertType<typeof record, UserDefaultSelect>();
        return 123;
      });

      assertType<typeof record, number | undefined>();

      expect(record).toBe(undefined);
    });

    it('should ignore a not found record in a sub query', async () => {
      await db.user.insert(UserData);

      const record = await db.user.take().select({
        sub: () => db.user.findOptional(0).map(() => 123),
      });

      assertType<typeof record, { sub: number | undefined }>();

      expect(record).toEqual({ sub: undefined });
    });

    it('should ignore null for an aggregate', async () => {
      const sum = await db.user.sum('Age').map((sum, i, data) => {
        assertType<typeof i, number>();
        assertType<typeof sum | typeof data, string>();
        return 0;
      });

      assertType<typeof sum, number | null>();

      expect(sum).toBe(null);
    });

    it('should ignore null for an aggregate in a sub query when not found', async () => {
      await db.user.insert(UserData);

      const record = await db.user.take().select({
        sub: () =>
          db.user
            .where({ Id: 0 })
            .sum('Age')
            .map(() => 123),
      });

      assertType<typeof record, { sub: number | null }>();

      expect(record).toEqual({ sub: null });
    });
  });

  describe('with data', () => {
    beforeAll(async () => {
      await db.user.insert(UserData);
    });

    it('should not apply map when doing aggregations', async () => {
      const res = await db.user
        .select('Name')
        .map(() => false)
        .count();

      assertType<Awaited<typeof res>, number>();

      expect(res).toBe(1);
    });

    it('should map multiple records', async () => {
      const res = await db.user.select('Name', 'createdAt').map(function (
        this: string,
        user,
        i,
        data,
      ) {
        return {
          nameLength: user.Name.length,
          createdAt: user.createdAt,
          index: i,
          names: data.map((user) => user.Name),
          self: this,
        };
      }, 'self');

      assertType<
        typeof res,
        {
          nameLength: number;
          createdAt: Date;
          index: number;
          names: string[];
          self: string;
        }[]
      >();

      expect(res).toEqual([
        {
          nameLength: UserData.Name.length,
          createdAt: expect.any(Date),
          index: 0,
          names: [UserData.Name],
          self: 'self',
        },
      ]);
    });

    it('should map a single record', async () => {
      const res = await db.user
        .select('Name', 'createdAt')
        .take()
        .map((user, i, value) => ({
          nameLength: user.Name.length,
          createdAt: user.createdAt,
          i,
          firstArgumentEqualsThird: user === value,
        }));

      assertType<
        typeof res,
        {
          nameLength: number;
          createdAt: Date;
          i: number;
          firstArgumentEqualsThird: boolean;
        }
      >();

      expect(res).toEqual({
        nameLength: UserData.Name.length,
        createdAt: expect.any(Date),
        i: 0,
        firstArgumentEqualsThird: true,
      });
    });

    it('should transform records in a sub-query', async () => {
      const res = await db.user.select('Id', {
        users: () =>
          db.user.select('Name', 'createdAt').map((user) => ({
            nameLength: user.Name.length,
            createdAt: user.createdAt,
          })),
      });

      assertType<
        typeof res,
        { Id: number; users: { nameLength: number; createdAt: Date }[] }[]
      >();

      expect(res).toEqual([
        {
          Id: expect.any(Number),
          users: [
            {
              nameLength: UserData.Name.length,
              createdAt: expect.any(Date),
            },
          ],
        },
      ]);
    });

    it('should not be called when there is no records for takeOptional', async () => {
      const fn = jest.fn();

      const res = await db.user.findOptional(0).map(fn);

      expect(res).toBe(undefined);
      expect(fn).not.toHaveBeenCalled();
    });

    describe('nested map', () => {
      it('should transform `all` result into `pluck`', async () => {
        const res = await db.user.select({
          nested: () =>
            db.user.select('Name').map(({ Name }) => `${Name} mapped`),
        });

        assertType<typeof res, { nested: string[] }[]>();

        expect(res).toEqual([{ nested: ['name mapped'] }]);
      });

      it('should transform `one` result into `value`', async () => {
        const res = await db.user.select({
          nested: () =>
            db.user
              .select('Name')
              .takeOptional()
              .map(({ Name }) => `${Name} mapped`),
        });

        assertType<typeof res, { nested: string | undefined }[]>();

        expect(res).toEqual([{ nested: 'name mapped' }]);
      });

      it('should transform `oneOrThrow` result into `valueOrThrow`', async () => {
        const res = await db.user.select({
          nested: () =>
            db.user
              .select('Name')
              .takeOptional()
              .map(({ Name }) => `${Name} mapped`),
        });

        assertType<typeof res, { nested: string | undefined }[]>();

        expect(res).toEqual([{ nested: 'name mapped' }]);
      });

      it('should handle `value` query', async () => {
        const res = await db.user.select({
          nested: () =>
            db.user.getOptional('Name').map((name) => `${name} mapped`),
        });

        assertType<typeof res, { nested: string | undefined }[]>();

        expect(res).toEqual([{ nested: 'name mapped' }]);
      });

      it('should handle `valueOrThrow` query', async () => {
        const res = await db.user.select({
          nested: () =>
            db.user.get('Name').map(function (this: string, name, i, data) {
              return `${name} ${i} ${data} ${this} mapped`;
            }, 'self'),
        });

        assertType<typeof res, { nested: string | null }[]>();

        expect(res).toEqual([{ nested: 'name 0 name self mapped' }]);
      });

      it('should handle `pluck` query', async () => {
        const res = await db.user.select({
          nested: () => db.user.pluck('Name').map((name) => `${name} mapped`),
        });

        assertType<typeof res, { nested: string[] }[]>();

        expect(res).toEqual([{ nested: ['name mapped'] }]);
      });

      it('should map `pluck` values to array of objects', async () => {
        const res = await db.user.pluck('Id').map((id) => ({ id, age: 18 }));

        assertType<typeof res, { id: number; age: number }[]>();

        expect(res).toEqual([{ id: expect.any(Number), age: 18 }]);
      });
    });
  });
});
