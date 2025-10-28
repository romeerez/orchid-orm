import {
  expectQueryNotMutated,
  Snake,
  snakeData,
  SnakeRecord,
  snakeSelectAll,
  Tag,
  UniqueTable,
  uniqueTableData,
  UniqueTableRecord,
  User,
  userColumnsSql,
  userData,
  UserInsert,
  UserRecord,
} from '../../test-utils/test-utils';
import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { MAX_BINDING_PARAMS } from '../../sql/constants';
import { omit } from '../../core';

const setMaxBindingParams = (value: number) => {
  (MAX_BINDING_PARAMS as unknown as { value: number }).value = value;
};

jest.mock('../../sql/constants', () => ({
  // Behold the power of JS coercions
  MAX_BINDING_PARAMS: {
    value: 5,
    toString() {
      return this.value;
    },
  },
}));

const TableWithReadOnly = testDb('table', (t) => ({
  id: t.identity().primaryKey(),
  key: t.string(),
  value: t.integer().readOnly(),
}));

const RuntimeDefaultTable = testDb('user', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text().default(() => 'runtime text'),
  password: t.text(),
}));

describe('create functions', () => {
  useTestDatabase();

  beforeEach(() => {
    setMaxBindingParams(5);
  });

  describe('create', () => {
    it('should not allow using appReadOnly columns', () => {
      expect(() =>
        TableWithReadOnly.create({
          key: 'key',
          // @ts-expect-error value is readOnly
          value: 123,
        }),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should create one record with raw SQL for a column value, should parse returned columns', async () => {
      const q = User.create({
        name: userData.name,
        password: () => sql<string>`'password'`,
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, 'password')
          RETURNING ${userColumnsSql}
        `,
        [userData.name],
      );

      const res = await q;

      assertType<typeof res, UserRecord>();

      expect(res.updatedAt).toBeInstanceOf(Date);
    });

    it('should support a query builder for a column', () => {
      const q = User.create({
        name: userData.name,
        // it's expected to fail on db side, cannot reference table
        password: (q) => q.ref('name'),
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, "user"."name")
          RETURNING ${userColumnsSql}
        `,
        [userData.name],
      );
    });

    it('should use a sub query value', () => {
      const q = User.create({
        ...userData,
        age: () => User.avg('age'),
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password", "age")
          VALUES ($1, $2, (SELECT avg("user"."age") FROM "user"))
          RETURNING ${userColumnsSql}
        `,
        [userData.name, userData.password],
      );
    });

    it('should support a `WITH` table value in other `WITH` clause', () => {
      const q = User.with('a', User.select('name').create(userData))
        .with('b', (q) =>
          User.select('id').create({
            name: () => q.from('a').get('name'),
            password: 'password',
          }),
        )
        .from('b');

      assertType<Awaited<typeof q>, { id: number }[]>();

      expectSql(
        q.toSQL(),
        `
          WITH "a" AS (
            INSERT INTO "user"("name", "password") VALUES ($1, $2)
            RETURNING "user"."name"
          ), "b" AS (
            INSERT INTO "user"("name", "password") VALUES (
              (SELECT "a"."name" FROM "a" LIMIT 1),
              $3
            )
            RETURNING "user"."id"
          )
          SELECT * FROM "b"
        `,
        ['name', 'password', 'password'],
      );
    });

    it('should create one record, returning record', async () => {
      const q = User.all();

      const query = q.create(userData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
        RETURNING ${userColumnsSql}
      `,
        ['name', 'password'],
      );

      const result = await query;
      expect(result).toMatchObject(omit(userData, ['password']));

      assertType<typeof result, UserRecord>();

      const created = await User.take();
      expect(created).toMatchObject(omit(userData, ['password']));

      expectQueryNotMutated(q);
    });

    it('should create one record with named columns, returning record', async () => {
      const query = Snake.create(snakeData);

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES ($1, $2)
          RETURNING ${snakeSelectAll}
        `,
        [snakeData.snakeName, snakeData.tailLength],
      );

      const result = await query;
      expect(result).toMatchObject(snakeData);

      assertType<typeof result, SnakeRecord>();

      const created = await Snake.take();
      expect(created).toMatchObject(snakeData);
    });

    it('should create one record, returning value', async () => {
      const q = User.all();

      const query = q.get('id').create(userData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
        RETURNING "user"."id"
      `,
        ['name', 'password'],
      );

      const result = await query;
      assertType<typeof result, number>();

      expect(typeof result).toBe('number');

      expectQueryNotMutated(q);
    });

    it('should create one record, returning value from named column', async () => {
      const query = Snake.get('snakeName').create(snakeData);
      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES ($1, $2)
          RETURNING "snake"."snake_name"
        `,
        [snakeData.snakeName, snakeData.tailLength],
      );

      const result = await query;
      assertType<typeof result, string>();

      expect(typeof result).toBe('string');
    });

    it('should create one record, returning columns', async () => {
      const q = User.all();

      const query = q.select('id', 'name').create(userData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
        RETURNING "user"."id", "user"."name"
      `,
        ['name', 'password'],
      );

      const result = await query;
      assertType<typeof result, { id: number; name: string }>();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...other } = userData;
      expect(result).toMatchObject(other);

      expectQueryNotMutated(q);
    });

    it('should support appending select', async () => {
      const result = await User.create(userData).select('id', 'name');

      assertType<typeof result, { id: number; name: string }>();

      expect(result).toEqual({ id: expect.any(Number), name: userData.name });
    });

    it('should create one record, returning named columns', async () => {
      const query = Snake.select('snakeName', 'tailLength').create(snakeData);
      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES ($1, $2)
          RETURNING "snake"."snake_name" "snakeName", "snake"."tail_length" "tailLength"
        `,
        [snakeData.snakeName, snakeData.tailLength],
      );

      const result = await query;
      assertType<
        typeof result,
        Pick<SnakeRecord, 'snakeName' | 'tailLength'>
      >();

      expect(result).toMatchObject(snakeData);
    });

    it('should create one record, returning created count', async () => {
      const q = User.all();

      const query = q.insert(userData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
      `,
        ['name', 'password'],
      );

      const result = await query;
      assertType<typeof result, number>();

      expect(result).toBe(1);

      expectQueryNotMutated(q);
    });

    it('should a create record with provided defaults', () => {
      const q = User.defaults({
        name: 'name',
        password: 'password',
      }).create({
        password: 'override',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
          RETURNING ${userColumnsSql}
        `,
        ['name', 'override'],
      );
    });

    it('should strip unknown keys', () => {
      const q = User.create({
        name: 'name',
        password: 'password',
        unknown: 'should be stripped',
      } as unknown as UserInsert);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
          RETURNING ${userColumnsSql}
        `,
        ['name', 'password'],
      );
    });

    it('should a create record with runtime default', () => {
      const q = RuntimeDefaultTable.create({
        password: 'password',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("password", "name")
          VALUES ($1, $2)
          RETURNING *
        `,
        ['password', 'runtime text'],
      );
    });

    it('should a create record with a sub query result for the column value', () => {
      const q = User.create({
        name: () => User.get('name'),
        password: 'password',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ((SELECT "user"."name" FROM "user" LIMIT 1), $1)
          RETURNING ${userColumnsSql}
        `,
        ['password'],
      );
    });

    it('should create a record with a sub query result from inserting', () => {
      const q = User.create({
        ...userData,
        name: () => User.create(userData).get('name'),
      });

      expectSql(
        q.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            RETURNING "user"."name"
          )
          INSERT INTO "user"("name", "password")
          VALUES ((SELECT "q"."name" FROM "q"), $3)
          RETURNING ${userColumnsSql}
        `,
        ['name', 'password', 'password'],
      );
    });

    it('should not call `encode` with undefined', () => {
      const table = testDb('table', (t) => ({
        id: t.identity().primaryKey(),
        key: t.text(),
        value: t
          .integer()
          .encode(() => 'encoded')
          .nullable(),
      }));

      const q = table.create({ key: 'key', value: undefined });

      expectSql(
        q.toSQL(),
        `INSERT INTO "table"("key") VALUES ($1) RETURNING *`,
        ['key'],
      );
    });

    it('should not call `encode` with undefined', () => {
      const table = testDb('table', (t) => ({
        id: t.identity().primaryKey(),
        value: t
          .integer()
          .encode(() => 'encoded')
          .nullable(),
      }));

      const q = table.create({ value: null });

      expectSql(
        q.toSQL(),
        `INSERT INTO "table"("value") VALUES ($1) RETURNING *`,
        [null],
      );
    });

    it('should create using values from CTE', async () => {
      const q = User.with('created1', () =>
        User.create({ name: 'user 1', password: 'password 1' }).select('name'),
      )
        .with('created2', () =>
          User.create({ name: 'user 2', password: 'password 2' }).select(
            'password',
          ),
        )
        .create({
          name: (q) => q.from('created1').get('name'),
          password: (q) => q.from('created2').get('password'),
        })
        .select('name', 'password');

      expectSql(
        q.toSQL(),
        `
          WITH "created1" AS (
            INSERT INTO "user"("name", "password") VALUES ($1, $2) RETURNING "user"."name"
          ),
          "created2" AS (
            INSERT INTO "user"("name", "password") VALUES ($3, $4) RETURNING "user"."password"
          )
          INSERT INTO "user"("name", "password")
          VALUES (
            (SELECT "created1"."name" FROM "created1" LIMIT 1),
            (SELECT "created2"."password" FROM "created2" LIMIT 1)
          )
          RETURNING "user"."name", "user"."password"
        `,
        ['user 1', 'password 1', 'user 2', 'password 2'],
      );

      const res = await q;

      expect(res).toEqual({ name: 'user 1', password: 'password 2' });
    });
  });

  describe('insert', () => {
    it('should return row count by default', async () => {
      const q = User.insert(userData);

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(1);
    });

    it('should return selected columns', async () => {
      const result = await User.select('name').insert(userData);

      assertType<typeof result, { name: string }>();

      expect(result).toEqual({ name: userData.name });
    });

    it('should support appending select', async () => {
      const result = await User.insert(userData).select('name');

      assertType<typeof result, { name: string }>();

      expect(result).toEqual({ name: userData.name });
    });

    it('should return a single selected value', async () => {
      const result = await User.get('name').insert(userData);

      assertType<typeof result, string>();

      expect(result).toBe(userData.name);
    });

    it('should support appending get', async () => {
      const result = await User.insert(userData).get('name');

      assertType<typeof result, string>();

      expect(result).toBe(userData.name);
    });

    it('should not encode value when it is an expression', () => {
      // json column has an encoder, and it shouldn't run for a raw expression
      const q = User.insert({
        ...userData,
        data: () => sql`'{"key":"value"}'`,
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password", "data")
          VALUES ($1, $2, '{"key":"value"}')
        `,
        ['name', 'password'],
      );
    });

    it('should treat null as a database NULL even for JSON column', () => {
      const q = User.insert({ ...userData, data: null });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password", "data")
          VALUES ($1, $2, $3)
        `,
        ['name', 'password', null],
      );
    });

    it('should not make an empty RETURNING because it is not valid SQL', async () => {
      const q = User.insert(userData).select();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
        `,
        ['name', 'password'],
      );

      const res = await q;
      expect(res).toEqual({});
    });
  });

  describe('createMany', () => {
    it('should not allow using appReadOnly columns', () => {
      expect(() =>
        TableWithReadOnly.createMany([
          {
            key: 'key',
            // @ts-expect-error value is readOnly
            value: 123,
          },
        ]),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should do nothing and return empty array when empty array is given', async () => {
      expect(await User.createMany([])).toEqual([]);
    });

    it('should create many records with raw SQL for a column value, should parse values', async () => {
      const q = User.createMany([
        {
          name: userData.name,
          password: () => sql<string>`'password'`,
        },
        {
          name: () => sql<string>`'name'`,
          password: userData.password,
        },
      ]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, 'password'), ('name', $2)
          RETURNING ${userColumnsSql}
        `,
        [userData.name, userData.password],
      );

      const res = await q;

      assertType<typeof res, UserRecord[]>();

      expect(res).toMatchObject([
        { updatedAt: expect.any(Date) },
        { updatedAt: expect.any(Date) },
      ]);
    });

    it('should create many records, returning inserted count', async () => {
      const q = User.all();

      const arr = [
        {
          ...userData,
          picture: null,
        },
        userData,
      ];

      const query = q.insertMany(arr);

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password", "picture")
        VALUES
          ($1, $2, $3),
          ($4, $5, DEFAULT)
      `,
        ['name', 'password', null, 'name', 'password'],
      );

      const result = await query;
      expect(result).toBe(2);

      assertType<typeof result, number>();

      const inserted = await User.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['password']));
      });

      expectQueryNotMutated(q);
    });

    it('should create many records, returning columns', async () => {
      const q = User.all();

      const arr = [
        {
          ...userData,
          picture: null,
        },
        userData,
      ];

      const query = q.select('id', 'name').createMany(arr);

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password", "picture")
        VALUES
          ($1, $2, $3),
          ($4, $5, DEFAULT)
        RETURNING "user"."id", "user"."name"
      `,
        ['name', 'password', null, 'name', 'password'],
      );

      const result = await query;
      assertType<typeof result, { id: number; name: string }[]>();

      const inserted = await User.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['password']));
      });

      expectQueryNotMutated(q);
    });

    it('should support appending select', async () => {
      const result = await User.createMany([userData, userData]).select(
        'id',
        'name',
      );

      assertType<typeof result, { id: number; name: string }[]>();

      expect(result).toEqual([
        { id: expect.any(Number), name: userData.name },
        { id: expect.any(Number), name: userData.name },
      ]);
    });

    it('should create many records, returning all columns', async () => {
      const q = User.all();

      const arr = [
        {
          ...userData,
          picture: null,
        },
        userData,
      ];

      const query = q.createMany(arr);

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "user"("name", "password", "picture")
        VALUES
          ($1, $2, $3),
          ($4, $5, DEFAULT)
        RETURNING ${userColumnsSql}
      `,
        ['name', 'password', null, 'name', 'password'],
      );

      const result = await query;
      result.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['password']));
      });

      assertType<typeof result, (typeof User.outputType)[]>();

      const inserted = await User.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['password']));
      });

      expectQueryNotMutated(q);
    });

    it('should create many records with runtime default', () => {
      const q = RuntimeDefaultTable.createMany([
        {
          password: 'one',
        },
        {
          password: 'two',
        },
      ]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("password", "name")
          VALUES ($1, $2), ($3, $4)
          RETURNING *
        `,
        ['one', 'runtime text', 'two', 'runtime text'],
      );
    });

    it('should strip unknown keys', () => {
      const query = User.createMany([
        {
          name: 'name',
          password: 'password',
          unknown: 'should be stripped',
        },
        {
          name: 'name',
          password: 'password',
          unknown: 'should be stripped',
        },
      ] as unknown as UserInsert[]);

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2), ($3, $4)
          RETURNING ${userColumnsSql}
        `,
        ['name', 'password', 'name', 'password'],
      );
    });

    it('should create records with a sub query result for the column value', () => {
      const q = User.createMany([
        {
          name: () => User.get('name'),
          password: 'password',
        },
      ]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ((SELECT "user"."name" FROM "user" LIMIT 1), $1)
          RETURNING ${userColumnsSql}
        `,
        ['password'],
      );
    });

    it('should create records with a sub query result from inserting', async () => {
      setMaxBindingParams(100);

      const q = User.createMany(
        Array.from({ length: 2 }, () => ({
          ...userData,
          name: () => User.create(userData).get('name'),
        })),
      );

      expectSql(
        q.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            RETURNING "user"."name"
          ), "q2" AS (
            INSERT INTO "user"("name", "password")
            VALUES ($4, $5)
            RETURNING "user"."name"
          )
          INSERT INTO "user"("name", "password")
          VALUES
            ((SELECT "q"."name" FROM "q"), $3),
            ((SELECT "q2"."name" FROM "q2"), $6)
          RETURNING ${userColumnsSql}
        `,
        ['name', 'password', 'password', 'name', 'password', 'password'],
      );
    });

    it('should override value return type with pluck', () => {
      const q = User.get('name').createMany([userData]);

      assertType<Awaited<typeof q>, string[]>();
    });

    it('should create multiple empty records', () => {
      const table = testDb('table', (t) => ({
        id: t.identity().primaryKey(),
      }));

      const q = table.createMany([{}, {}, {}]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "table"("id")
          VALUES (DEFAULT), (DEFAULT), (DEFAULT)
          RETURNING *
        `,
      );
    });

    it('should not call `encode` with undefined', () => {
      setMaxBindingParams(6);

      const table = testDb('table', (t) => ({
        id: t.identity().primaryKey(),
        key: t.text(),
        value: t
          .integer()
          .encode(() => 'encoded')
          .nullable(),
      }));

      const q = table.createMany([
        { key: 'key', value: 1 },
        { key: 'key' },
        { key: 'key', value: 1 },
        { key: 'key' },
      ]);

      expectSql(
        q.toSQL(),
        `INSERT INTO "table"("key", "value") VALUES ($1, $2), ($3, DEFAULT), ($4, $5), ($6, DEFAULT) RETURNING *`,
        ['key', 'encoded', 'key', 'key', 'encoded', 'key'],
      );
    });

    describe('auto-batching lots of value groups', () => {
      it('should split large insert into batches', () => {
        const q = Tag.insertMany(
          Array.from({ length: 12 }, (_, i) => ({
            tag: `${i}`,
          })),
        );

        const sql = q.toSQL();
        expect(sql).toEqual({
          batch: [
            {
              text: `INSERT INTO "tag"("tag") VALUES ($1), ($2), ($3), ($4), ($5)`,
              values: ['0', '1', '2', '3', '4'],
            },
            {
              text: `INSERT INTO "tag"("tag") VALUES ($1), ($2), ($3), ($4), ($5)`,
              values: ['5', '6', '7', '8', '9'],
            },
            {
              text: `INSERT INTO "tag"("tag") VALUES ($1), ($2)`,
              values: ['10', '11'],
            },
          ],
        });
      });

      it('should support batching inserts with `with` CTEs', () => {
        const q = Tag.insertMany(
          Array.from({ length: 6 }, (_, i) => ({
            tag: () => Tag.create({ tag: `${i}` }).get('tag'),
          })),
        );

        const sql = q.toSQL();
        const insert = (i: number) =>
          `INSERT INTO "tag"("tag") VALUES ($${i}) RETURNING "tag"."tag"`;
        expect(sql).toEqual({
          batch: [
            {
              text:
                `WITH "q" AS (${insert(1)}), "q2" AS (${insert(
                  2,
                )}), "q3" AS (${insert(3)}), "q4" AS (${insert(
                  4,
                )}), "q5" AS (${insert(5)}) ` +
                'INSERT INTO "tag"("tag") VALUES ' +
                '((SELECT "q"."tag" FROM "q")), ((SELECT "q2"."tag" FROM "q2")), ((SELECT "q3"."tag" FROM "q3")), ' +
                '((SELECT "q4"."tag" FROM "q4")), ((SELECT "q5"."tag" FROM "q5"))',
              values: ['0', '1', '2', '3', '4'],
            },
            {
              text: `WITH "q6" AS (${insert(
                1,
              )}) INSERT INTO "tag"("tag") VALUES ((SELECT "q6"."tag" FROM "q6"))`,
              values: ['5'],
            },
          ],
        });
      });

      it('should throw when too many values for single insert group', () => {
        const q = User.insertMany([
          {
            id: 1,
            name: 'name',
            password: 'password',
            picture: 'picture',
            data: null,
            age: 25,
          },
        ]);

        expect(() => q.toSQL()).toThrow(
          'Too many parameters for a single insert row',
        );
      });
    });

    it('should create many using values from CTE', async () => {
      const q = User.with('created1', () =>
        User.create({ name: 'user 1', password: 'password 1' }).select(
          'name',
          'password',
        ),
      )
        .with('created2', () =>
          User.create({ name: 'user 2', password: 'password 2' }).select(
            'name',
            'password',
          ),
        )
        .createMany([
          {
            name: (q) => q.from('created1').get('name'),
            password: (q) => q.from('created2').get('password'),
          },
          {
            name: (q) => q.from('created2').get('name'),
            password: (q) => q.from('created1').get('password'),
          },
        ])
        .select('name', 'password');

      expectSql(
        q.toSQL(),
        `
          WITH "created1" AS (
            INSERT INTO "user"("name", "password") VALUES ($1, $2) RETURNING "user"."name", "user"."password"
          ),
          "created2" AS (
            INSERT INTO "user"("name", "password") VALUES ($3, $4) RETURNING "user"."name", "user"."password"
          )
          INSERT INTO "user"("name", "password")
          VALUES (
            (SELECT "created1"."name" FROM "created1" LIMIT 1),
            (SELECT "created2"."password" FROM "created2" LIMIT 1)
          ), (
            (SELECT "created2"."name" FROM "created2" LIMIT 1),
            (SELECT "created1"."password" FROM "created1" LIMIT 1)
          )
          RETURNING "user"."name", "user"."password"
        `,
        ['user 1', 'password 1', 'user 2', 'password 2'],
      );

      const res = await q;

      expect(res).toEqual([
        { name: 'user 1', password: 'password 2' },
        { name: 'user 2', password: 'password 1' },
      ]);
    });

    it('should fail in batch mode when there is a non-select query in CTE', async () => {
      const q = User.with('created', () =>
        User.create({ name: 'user 1', password: 'password 1' }).select(
          'name',
          'password',
        ),
      )
        .createMany([
          {
            name: 'first',
            age: 20,
            password: (q) => q.from('created').get('password'),
          },
          {
            name: 'second',
            age: 30,
            password: (q) => q.from('created').get('password'),
          },
          {
            name: 'third',
            age: 40,
            password: (q) => q.from('created').get('password'),
          },
        ])
        .select('name', 'password');

      expect(() => q.toSQL()).toThrow(
        'Cannot insert many records when having a non-select sub-query',
      );
    });
  });

  describe('insertMany', () => {
    it('should do nothing and return 0 when empty array is given', async () => {
      expect(await User.insertMany([])).toBe(0);
    });

    it('should return row count by default', async () => {
      const result = await User.insertMany([userData, userData]);

      assertType<typeof result, number>();

      expect(result).toBe(2);
    });

    it('should return records with selected columns', async () => {
      const result = await User.select('name').insertMany([userData, userData]);

      assertType<typeof result, { name: string }[]>();

      expect(result).toEqual([
        { name: userData.name },
        { name: userData.name },
      ]);
    });

    it('should support appending select', async () => {
      const result = await User.insertMany([userData, userData]).select('name');

      assertType<typeof result, { name: string }[]>();

      expect(result).toEqual([
        { name: userData.name },
        { name: userData.name },
      ]);
    });

    it('should override single returning value with multiple', async () => {
      const result = await User.get('name').insertMany([userData, userData]);

      assertType<typeof result, string[]>();

      expect(result).toEqual([userData.name, userData.name]);
    });
  });

  describe('onConflict', () => {
    it('should accept where condition', () => {
      const q = User.all();

      const query = q
        .select('id')
        .create(userData)
        .onConflictDoNothing('name')
        .where({ name: 'where name' });

      expectSql(
        query.toSQL(),
        `
            INSERT INTO "user"("name", "password")
            VALUES ($2, $3)
            ON CONFLICT ("name") DO NOTHING
            WHERE "user"."name" = $1
            RETURNING "user"."id"
          `,
        ['where name', 'name', 'password'],
      );

      expectQueryNotMutated(q);
    });

    it('should accept unique constraint name', () => {
      const table = testDb(
        'table',
        (t) => ({
          id: t.identity(),
          name: t.text(),
          password: t.text(),
        }),
        (t) => t.primaryKey(['id', 'name'], 'pkey'),
      );

      const q = table.insert(userData).onConflictDoNothing({
        constraint: 'pkey',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "table"("name", "password")
          VALUES ($1, $2)
          ON CONFLICT ON CONSTRAINT "pkey" DO NOTHING
        `,
        ['name', 'password'],
      );
    });

    describe('ignore', () => {
      it('should perform `ON CONFLICT` without a target', () => {
        const q = User.all();

        const query = q.insert(userData).onConflictDoNothing();
        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(userData).onConflictDoNothing('id');
        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("id") DO NOTHING
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single named column', () => {
        const query = Snake.count()
          .create(snakeData)
          .onConflictDoNothing('snakeName');

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($1, $2)
            ON CONFLICT ("snake_name") DO NOTHING
          `,
          [snakeData.snakeName, snakeData.tailLength],
        );
      });

      it('should accept multiple columns', () => {
        const table = testDb(
          'table',
          (t) => ({
            id: t.identity(),
            name: t.text(),
            password: t.text(),
          }),
          (t) => t.primaryKey(['id', 'name']),
        );

        const q = table
          .count()
          .create(userData)
          .onConflictDoNothing(['id', 'name']);

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "table"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("id", "name") DO NOTHING
          `,
          ['name', 'password'],
        );
      });

      it('should accept multiple named columns', () => {
        const table = testDb(
          'snake',
          (t) => ({
            snakeName: t.name('snake_name').text(),
            tailLength: t.name('tail_length').integer(),
          }),
          (t) => t.primaryKey(['snakeName', 'tailLength']),
        );

        const q = table
          .count()
          .create(snakeData)
          .onConflictDoNothing(['snakeName', 'tailLength']);

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($1, $2)
            ON CONFLICT ("snake_name", "tail_length") DO NOTHING
          `,
          [snakeData.snakeName, snakeData.tailLength],
        );
      });

      it('can accept raw query', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflictDoNothing(sql`raw query`);

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT raw query DO NOTHING
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should override query return type from oneOrThrow to one', async () => {
        await UniqueTable.create(uniqueTableData);

        const q = UniqueTable.take()
          .create(uniqueTableData)
          .onConflictDoNothing();

        const result = await q;

        assertType<typeof result, UniqueTableRecord | undefined>();

        expect(result).toBe(undefined);
      });

      it('should override query return type from valueOrThrow to value', async () => {
        await UniqueTable.create(uniqueTableData);

        const q = UniqueTable.get('id')
          .create(uniqueTableData)
          .onConflictDoNothing();

        const result = await q;

        assertType<typeof result, number | undefined>();

        expect(result).toBe(undefined);
      });
    });

    describe('set', () => {
      it('should not allow using appReadOnly columns', () => {
        expect(() =>
          TableWithReadOnly.create({ key: '' }).onConflict('id').set({
            // @ts-expect-error value is readOnly
            value: '',
          }),
        ).toThrow('Trying to insert a readonly column');
      });

      it('should accept object with values to update', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict('name')
          .set({ name: 'new name' });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($2, $3)
            ON CONFLICT ("name")
            DO UPDATE SET "name" = $1
          `,
          ['new name', 'name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept object with values to update for named column', () => {
        const query = Snake.count()
          .create(snakeData)
          .onConflict('snakeName')
          .set({ snakeName: 'new name' });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($2, $3)
            ON CONFLICT ("snake_name")
            DO UPDATE SET "snake_name" = $1
          `,
          ['new name', snakeData.snakeName, snakeData.tailLength],
        );
      });

      it('should accept raw sql', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict(sql`on conflict raw`)
          .set({
            name: () => sql`${'new name'}`,
          });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($2, $3)
            ON CONFLICT on conflict raw
            DO UPDATE SET "name" = $1
          `,
          ['new name', 'name', 'password'],
        );

        expectQueryNotMutated(q);
      });
    });

    describe('merge', () => {
      it(`should merge all columns except onConflict's column`, () => {
        const q = User.insert(userData).onConflict('name').merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name")
            DO UPDATE SET "password" = excluded."password"
          `,
          ['name', 'password'],
        );
      });

      it(`should merge all columns except onConflict's multiple columns`, () => {
        const table = testDb(
          'table',
          (t) => ({
            id: t.identity(),
            name: t.text(),
            password: t.text(),
          }),
          (t) => t.primaryKey(['id', 'name']),
        );

        const q = table
          .insert({ id: 1, name: 'name', password: 'password' })
          .onConflict(['id', 'name'])
          .merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "table"("id", "name", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id", "name")
            DO UPDATE SET "password" = excluded."password"
          `,
          [1, 'name', 'password'],
        );
      });

      it('should DO NOTHING if all columns are excluded', () => {
        const q = User.insert({ name: 'name' } as never)
          .onConflict('name')
          .merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "user"("name")
            VALUES ($1)
            ON CONFLICT ("name")
            DO UPDATE SET "name" = excluded."name"
          `,
          ['name'],
        );
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict('name')
          .merge('name');

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name")
            DO UPDATE SET "name" = excluded."name"
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single named column', () => {
        const query = Snake.count()
          .create(snakeData)
          .onConflict('snakeName')
          .merge('snakeName');

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($1, $2)
            ON CONFLICT ("snake_name")
            DO UPDATE SET "snake_name" = excluded."snake_name"
          `,
          [snakeData.snakeName, snakeData.tailLength],
        );
      });

      it('should accept multiple columns', () => {
        const table = testDb(
          'table',
          (t) => ({
            id: t.identity(),
            name: t.text(),
            password: t.text(),
          }),
          (t) => t.primaryKey(['id', 'name']),
        );

        const q = table
          .count()
          .create(userData)
          .onConflict(['id', 'name'])
          .merge(['name', 'password']);

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "table"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("id", "name")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password"
          `,
          ['name', 'password'],
        );
      });

      it('should accept multiple named columns', () => {
        const table = testDb(
          'snake',
          (t) => ({
            snakeName: t.name('snake_name').text(),
            tailLength: t.name('tail_length').integer(),
          }),
          (t) => t.primaryKey(['snakeName', 'tailLength']),
        );

        const q = table
          .count()
          .create(snakeData)
          .onConflict(['snakeName', 'tailLength'])
          .merge(['snakeName', 'tailLength']);

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($1, $2)
            ON CONFLICT ("snake_name", "tail_length")
            DO UPDATE SET
              "snake_name" = excluded."snake_name",
              "tail_length" = excluded."tail_length"
          `,
          [snakeData.snakeName, snakeData.tailLength],
        );
      });

      it('should merge all except specified and target, it is useful when the column has a runtime default', () => {
        const table = testDb(
          'table',
          (t) => ({
            id: t.identity(),
            name: t.text(),
            password: t.text(),
            hasDefault: t.text().default(() => 'default'),
          }),
          (t) => t.primaryKey(['id', 'name']),
        );

        const q = table
          .count()
          .create(userData)
          .onConflict(['id', 'name'])
          .merge({ except: 'hasDefault' });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "table"("name", "password", "has_default")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id", "name")
            DO UPDATE SET "password" = excluded."password"
          `,
          ['name', 'password', 'default'],
        );
      });
    });
  });
});
