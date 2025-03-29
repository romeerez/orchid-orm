import {
  Chat,
  chatData,
  expectQueryNotMutated,
  Message,
  messageColumnsSql,
  MessageRecord,
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
} from '../test-utils/test-utils';
import {
  assertType,
  expectSql,
  sql,
  testDb,
  useTestDatabase,
} from 'test-utils';
import { raw } from '../sql/rawSql';
import { MAX_BINDING_PARAMS } from '../sql/constants';
import { omit } from 'orchid-core';

const setMaxBindingParams = (value: number) => {
  (MAX_BINDING_PARAMS as unknown as { value: number }).value = value;
};

jest.mock('../sql/constants', () => ({
  // Behold the power of JS coercions
  MAX_BINDING_PARAMS: {
    value: 5,
    toString() {
      return this.value;
    },
  },
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

  describe('createRaw', () => {
    it('should create with raw sql and list of columns', () => {
      const q = User.all();

      const query = q.createRaw({
        columns: ['name', 'password'],
        values: raw`raw sql`,
      });

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES (raw sql)
          RETURNING ${userColumnsSql}
        `,
      );

      assertType<Awaited<typeof query>, UserRecord>();

      expectQueryNotMutated(q);
    });

    it('should add runtime default', () => {
      const q = RuntimeDefaultTable.createRaw({
        columns: ['password'],
        values: raw`'password'`,
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("password", "name")
          VALUES ('password', $1)
          RETURNING *
        `,
        ['runtime text'],
      );
    });

    it('should create with raw sql and list of columns with names', () => {
      const query = Snake.createRaw({
        columns: ['snakeName', 'tailLength'],
        values: raw`raw sql`,
      });
      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES (raw sql)
          RETURNING ${snakeSelectAll}
        `,
      );
    });
  });

  describe('insertRaw', () => {
    it('should return inserted row column by default', async () => {
      const q = User.insertRaw({
        columns: ['name', 'password'],
        values: raw`'name', 'password'`,
      });

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(1);
    });

    it('should return selected columns', async () => {
      const q = User.select('name').insertRaw({
        columns: ['name', 'password'],
        values: raw`'name', 'password'`,
      });

      const result = await q;

      assertType<typeof result, { name: string }>();

      expect(result).toEqual({ name: 'name' });
    });

    it('should return selected columns when appending select', async () => {
      const q = User.insertRaw({
        columns: ['name', 'password'],
        values: raw`'name', 'password'`,
      }).select('name');

      const result = await q;

      assertType<typeof result, { name: string }>();

      expect(result).toEqual({ name: 'name' });
    });

    it('should override pluck to a single value', async () => {
      const q = User.pluck('name').insertRaw({
        columns: ['name', 'password'],
        values: raw`'name', 'password'`,
      });

      const result = await q;

      assertType<typeof result, string>();

      expect(result).toEqual('name');
    });
  });

  describe('createManyRaw', () => {
    it('should create with raw sql and list of columns', () => {
      const q = User.all();

      const query = q.createManyRaw({
        columns: ['name', 'password'],
        values: [raw`sql1`, raw`sql2`],
      });
      expectSql(
        query.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES (sql1), (sql2)
          RETURNING ${userColumnsSql}
        `,
      );

      assertType<Awaited<typeof query>, UserRecord[]>();

      expectQueryNotMutated(q);
    });

    it('should add runtime default', () => {
      const q = RuntimeDefaultTable.createManyRaw({
        columns: ['password'],
        values: [raw`'pw1'`, raw`'pw2'`],
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("password", "name")
          VALUES ('pw1', $1), ('pw2', $2)
          RETURNING *
        `,
        ['runtime text', 'runtime text'],
      );
    });

    it('should create with raw sql and list of columns with names', () => {
      const query = Snake.createManyRaw({
        columns: ['snakeName', 'tailLength'],
        values: [raw`sql1`, raw`sql2`],
      });
      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES (sql1), (sql2)
          RETURNING ${snakeSelectAll}
        `,
      );
    });
  });

  describe('insertManyRaw', () => {
    it('should return inserted row count by default', async () => {
      const q = User.insertManyRaw({
        columns: ['name', 'password'],
        values: [raw`'name', 'password'`, raw`'name', 'password'`],
      });

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(2);
    });

    it('should return multiple records', async () => {
      const q = User.take()
        .select('name')
        .insertManyRaw({
          columns: ['name', 'password'],
          values: [raw`'name', 'password'`, raw`'name', 'password'`],
        });

      const result = await q;

      assertType<Awaited<typeof q>, { name: string }[]>();

      expect(result).toEqual([{ name: 'name' }, { name: 'name' }]);
    });

    it('should return multiple records when appending select', async () => {
      const q = User.take()
        .insertManyRaw({
          columns: ['name', 'password'],
          values: [raw`'name', 'password'`, raw`'name', 'password'`],
        })
        .select('name');

      const result = await q;

      assertType<Awaited<typeof q>, { name: string }[]>();

      expect(result).toEqual([{ name: 'name' }, { name: 'name' }]);
    });

    it('should override selected value with a pluck', async () => {
      const q = User.take()
        .get('name')
        .insertManyRaw({
          columns: ['name', 'password'],
          values: [raw`'name', 'password'`, raw`'name', 'password'`],
        });

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['name', 'name']);
    });

    it('should support appending pluck', async () => {
      const q = User.take()
        .insertManyRaw({
          columns: ['name', 'password'],
          values: [raw`'name', 'password'`, raw`'name', 'password'`],
        })
        .pluck('name');

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['name', 'name']);
    });
  });

  describe('create', () => {
    it('should create one record with raw SQL for a column value', () => {
      const q = User.create({
        name: userData.name,
        password: () => sql<string>`'password'`,
      });

      assertType<Awaited<typeof q>, UserRecord>();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, 'password')
          RETURNING ${userColumnsSql}
        `,
        [userData.name],
      );
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
        age: User.avg('age'),
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

    it('should create record with provided defaults', () => {
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

    it('should create record with runtime default', () => {
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

    it('should create record with a sub query result for the column value', () => {
      const q = User.create({
        name: User.get('name'),
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
      const q = User.insert({ ...userData, data: raw`'{"key":"value"}'` });

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
    it('should do nothing and return empty array when empty array is given', async () => {
      expect(await User.createMany([])).toEqual([]);
    });

    it('should create many records with raw SQL for a column value', () => {
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

      assertType<Awaited<typeof q>, UserRecord[]>();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, 'password'), ('name', $2)
          RETURNING ${userColumnsSql}
        `,
        [userData.name, userData.password],
      );
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
          name: User.get('name'),
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

  describe('createFrom', () => {
    it('should create records without additional data', () => {
      const sub = Chat.find(1).select({ chatId: 'idOfChat' });
      const q = Message.createFrom(sub);

      assertType<Awaited<typeof q>, MessageRecord>();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "message"("chat_id")
          SELECT "chat"."id_of_chat" "chatId"
          FROM "chat"
          WHERE "chat"."id_of_chat" = $1
          LIMIT 1
          RETURNING ${messageColumnsSql}
        `,
        [1],
      );
    });

    it('should create record from select with additional data', () => {
      const chat = Chat.find(1).select({ chatId: 'idOfChat' });

      const query = Message.createFrom(chat, {
        authorId: 1,
        text: raw`'text'`,
      });

      assertType<Awaited<typeof query>, MessageRecord>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "message"("chat_id", "author_id", "text")
          SELECT "chat"."id_of_chat" "chatId", $1, 'text'
          FROM "chat"
          WHERE "chat"."id_of_chat" = $2
          LIMIT 1
          RETURNING ${messageColumnsSql}
        `,
        [1, 1],
      );
    });

    it('should create record from select with named columns', () => {
      const user = User.find(1).select({ snakeName: 'name' });

      const query = Snake.createFrom(user, {
        tailLength: 5,
      });

      assertType<Awaited<typeof query>, SnakeRecord>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          SELECT "user"."name" "snakeName", $1
          FROM "user"
          WHERE "user"."id" = $2
          LIMIT 1
          RETURNING ${snakeSelectAll}
        `,
        [5, 1],
      );
    });

    it('should add runtime defaults', () => {
      const q = RuntimeDefaultTable.createFrom(
        User.find(123).select('password'),
        {
          id: 456,
        },
      );

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "user"("password", "id", "name")
          SELECT "user"."password", $1, $2
          FROM "user"
          WHERE "user"."id" = $3
          LIMIT 1
          RETURNING *
        `,
        [456, 'runtime text', 123],
      );
    });

    it('should not allow to create from query which returns multiple records', () => {
      expect(() =>
        Message.createFrom(
          // @ts-expect-error creating from multiple records is not allowed
          Chat.where({ id: { in: [1, 2] } }).select({ chatId: 'id' }),
          {
            authorId: 1,
            text: 'text',
          },
        ),
      ).toThrow(
        'Cannot create based on a query which returns multiple records',
      );
    });

    it('should support appending select', async () => {
      const user = await User.create(userData);

      const sub = User.find(user.id).select('name', 'password');

      const result = await User.createFrom(sub).select('name');

      assertType<typeof result, { name: string }>();

      expect(result).toEqual({ name: userData.name });
    });
  });

  describe('insertFrom', () => {
    it('should return inserted row count by default', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.insertFrom(chat, { authorId, text: 'text' });

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(1);
    });

    it('should override selecting multiple with selecting one', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.select('text').insertFrom(chat, {
        authorId,
        text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, { text: string }>();

      expect(result).toEqual({ text: 'text' });
    });

    it('should override selecting pluck with selecting value', async () => {
      const authorId = await User.get('id').create(userData);
      const chatId = await Chat.get('idOfChat').create(chatData);
      const chat = Chat.find(chatId).select({ chatId: 'idOfChat' });

      const q = Message.pluck('text').insertFrom(chat, {
        authorId,
        text: 'text',
      });

      const result = await q;

      assertType<Awaited<typeof q>, string>();

      expect(result).toBe('text');
    });
  });

  describe('createManyFrom', () => {
    it('should create records from select', () => {
      const sub = Chat.where({ title: 'title' }).select({ chatId: 'idOfChat' });
      const query = Message.createManyFrom(sub);

      assertType<Awaited<typeof query>, MessageRecord[]>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "message"("chat_id")
          SELECT "chat"."id_of_chat" "chatId"
          FROM "chat"
          WHERE "chat"."title" = $1
          RETURNING ${messageColumnsSql}
        `,
        ['title'],
      );
    });

    it('should create record from select with named columns', () => {
      const sub = User.where({ name: 'name' }).select({ snakeName: 'name' });
      const query = Snake.createManyFrom(sub);

      assertType<Awaited<typeof query>, SnakeRecord[]>();

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "snake"("snake_name")
          SELECT "user"."name" "snakeName"
          FROM "user"
          WHERE "user"."name" = $1
          RETURNING ${snakeSelectAll}
        `,
        ['name'],
      );
    });

    it('should support appending select', async () => {
      const user = await User.create(userData);

      const sub = User.where({ id: user.id }).select('name', 'password');

      const result = await User.createManyFrom(sub).select('name');

      assertType<typeof result, { name: string }[]>();

      expect(result).toEqual([{ name: userData.name }]);
    });
  });

  describe('insertManyFrom', () => {
    it('should return inserted row count by default', async () => {
      const chatId = await Chat.get('idOfChat').create(chatData);

      const sub = Chat.find(chatId).select({
        chatId: 'idOfChat',
        text: (q) => q.val('title'),
      });
      const q = Message.insertManyFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, number>();

      expect(result).toBe(1);
    });

    it('should override selecting single with selecting multiple', async () => {
      const chatId = await Chat.get('idOfChat').create(chatData);

      const sub = Chat.find(chatId).select({
        chatId: 'idOfChat',
        text: 'title',
      });

      const q = Message.take().select('text').insertManyFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, { text: string }[]>();

      expect(result).toEqual([{ text: 'title' }]);
    });

    it('should override selecting value with selecting pluck', async () => {
      const chatId = await Chat.get('idOfChat').create(chatData);

      const sub = Chat.find(chatId).select({
        chatId: 'idOfChat',
        text: 'title',
      });

      const q = Message.get('text').insertManyFrom(sub);

      const result = await q;

      assertType<Awaited<typeof q>, string[]>();

      expect(result).toEqual(['title']);
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
          .onConflictDoNothing(raw`raw query`);

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
          .onConflict(raw`on conflict raw`)
          .set(raw`merge raw`);

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT on conflict raw
            DO UPDATE SET merge raw
          `,
          ['name', 'password'],
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
