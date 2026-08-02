import {
  expectQueryNotMutated,
  uniqueTableData,
} from '../../../test-utils/pqb.test-utils';
import {
  assertType,
  db,
  expectSql,
  MessageData,
  now,
  sql,
  testDb,
  UserData,
  UserDefaultSelect,
  UserSelectAll,
  useTestDatabase,
} from 'test-utils';
import { MAX_BINDING_PARAMS } from '../../sql/sql-constants';
import { omit } from '../../../utils';

const setMaxBindingParams = (value: number) => {
  (MAX_BINDING_PARAMS as unknown as { value: number }).value = value;
};

jest.mock('../../sql/sql-constants', () => ({
  // Behold the power of JS coercions
  MAX_BINDING_PARAMS: {
    value: 5,
    toString() {
      return this.value;
    },
  },
}));

const TableWithReadOnly = testDb(
  'table',
  (t) => ({
    id: t.identity().primaryKey(),
    key: t.string(),
    value: t.integer().readOnly(),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

const RuntimeDefaultTable = testDb(
  'User',
  (t) => ({
    id: t.serial().primaryKey(),
    name: t.text().default(() => 'runtime text'),
    password: t.text(),
  }),
  undefined,
  {
    schema: () => 'schema',
  },
);

const minUserData = {
  Name: UserData.Name,
  UserKey: UserData.UserKey,
  Password: UserData.Password,
};

describe('create functions', () => {
  useTestDatabase();

  beforeEach(() => {
    setMaxBindingParams(12);
  });

  describe('create', () => {
    it('should alias returning columns with `as` that matches the nameInDb', () => {
      const q = db.message.as('message').create(MessageData).select('Text');

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."message"("text", "message_key", "updated_at", "created_at")
          VALUES ($1, $2, $3, $4)
          RETURNING "message"."text" "Text"
        `,
        ['text', 'key', expect.any(Date), expect.any(Date)],
      );
    });

    it('should not allow using appReadOnly columns', () => {
      expect(() =>
        // @ts-expect-error value is readOnly
        TableWithReadOnly.create({
          key: 'key',
          value: 123,
        }),
      ).toThrow('Trying to insert a readonly column');
    });

    it('should create one record with raw SQL for a column value, should parse returned columns', async () => {
      const q = db.user.create({
        ...minUserData,
        Password: () => sql<string>`'password'`,
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, 'password')
          RETURNING ${UserSelectAll}
        `,
        [UserData.Name, UserData.UserKey],
      );

      const res = await q;

      assertType<typeof res, UserDefaultSelect>();

      expect(res.updatedAt).toEqual(expect.any(Date));
    });

    it('should support a query builder for a column', () => {
      const q = db.user.create({
        ...minUserData,
        // it's expected to fail on db side, cannot reference table
        Password: (q) => q.ref('Name'),
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, "User"."name")
          RETURNING ${UserSelectAll}
        `,
        [UserData.Name, UserData.UserKey],
      );
    });

    it('should use a sub query value', () => {
      const q = db.user.create({
        ...minUserData,
        Age: () => db.user.avg('Age'),
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "age")
          VALUES ($1, $2, $3, (SELECT avg("User"."age") FROM "schema"."user" "User"))
          RETURNING ${UserSelectAll}
        `,
        [UserData.Name, UserData.UserKey, UserData.Password],
      );
    });

    it('should support a `WITH` table value in other `WITH` clause', () => {
      const q = db.user
        .with('a', db.user.select('Name').create(minUserData))
        .with('b', (q) =>
          db.user.select('Id').create({
            Name: () => q.from('a').get('Name'),
            UserKey: 'key',
            Password: 'password',
          }),
        )
        .from('b');

      assertType<Awaited<typeof q>, { Id: number }[]>();

      expectSql(
        q.toSQL(),
        `
          WITH "a" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") VALUES ($1, $2, $3)
            RETURNING "User"."name" "Name"
          ), "b" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") VALUES (
              (SELECT "a"."Name" FROM "a" LIMIT 1),
              $4, $5
            )
            RETURNING "User"."id" "Id"
          )
          SELECT * FROM "b"
        `,
        ['name', 'key', 'password', 'key', 'password'],
      );
    });

    it('should create one record, returning record', async () => {
      const q = db.user.all();

      const query = q.create(UserData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "updated_at", "created_at")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING ${UserSelectAll}
      `,
        ['name', 'key', 'password', now, now],
      );

      const result = await query;
      expect(result).toMatchObject(omit(UserData, ['Password']));

      assertType<typeof result, UserDefaultSelect>();

      const created = await db.user.take();
      expect(created).toMatchObject(omit(UserData, ['Password']));

      expectQueryNotMutated(q);
    });

    it('should create one record, returning value', async () => {
      const q = db.user.all();

      const query = q.get('Id').create(minUserData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
        VALUES ($1, $2, $3)
        RETURNING "User"."id"
      `,
        ['name', 'key', 'password'],
      );

      const result = await query;
      assertType<typeof result, number>();

      expect(typeof result).toBe('number');

      expectQueryNotMutated(q);
    });

    it('should create one record, returning columns', async () => {
      const q = db.user.all();

      const query = q.select('Id', 'Name').create(minUserData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
        VALUES ($1, $2, $3)
        RETURNING "User"."id" "Id", "User"."name" "Name"
      `,
        ['name', 'key', 'password'],
      );

      const result = await query;
      assertType<typeof result, { Id: number; Name: string }>();

      expect(result).toMatchObject({
        Id: expect.any(Number),
        Name: UserData.Name,
      });

      expectQueryNotMutated(q);
    });

    it('should support appending select', async () => {
      const result = await db.user.create(minUserData).select('Id', 'Name');

      assertType<typeof result, { Id: number; Name: string }>();

      expect(result).toEqual({ Id: expect.any(Number), Name: UserData.Name });
    });

    it('should create one record, returning created count', async () => {
      const q = db.user.all();

      const query = q.insert(minUserData);
      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
        VALUES ($1, $2, $3)
      `,
        ['name', 'key', 'password'],
      );

      const result = await query;
      assertType<typeof result, number>();

      expect(result).toBe(1);

      expectQueryNotMutated(q);
    });

    it('should a create record with provided defaults', () => {
      const q = db.user
        .defaults({
          Name: 'name',
          UserKey: 'key',
          Password: 'password',
        })
        .create({
          Password: 'override',
        });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, $3)
          RETURNING ${UserSelectAll}
        `,
        ['name', 'key', 'override'],
      );
    });

    it('should strip unknown keys', () => {
      const q = db.user.create({
        Name: 'name',
        UserKey: 'key',
        Password: 'password',
        unknown: 'should be stripped',
      } as unknown as typeof db.user.__inputType);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, $3)
          RETURNING ${UserSelectAll}
        `,
        ['name', 'key', 'password'],
      );
    });

    it('should a create record with runtime default', () => {
      const q = RuntimeDefaultTable.create({
        password: 'password',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("password", "name")
          VALUES ($1, $2)
          RETURNING *
        `,
        ['password', 'runtime text'],
      );
    });

    it('should a create record with a sub query result for the column value', () => {
      const q = db.user.create({
        Name: () => db.user.get('Name'),
        UserKey: 'key',
        Password: 'password',
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ((SELECT "User"."name" FROM "schema"."user" "User" LIMIT 1), $1, $2)
          RETURNING ${UserSelectAll}
        `,
        ['key', 'password'],
      );
    });

    it('should create a record with a sub query result from inserting', () => {
      const q = db.user.create({
        ...minUserData,
        Name: () => db.user.create(minUserData).get('Name'),
      });

      expectSql(
        q.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            RETURNING "User"."name" "Name"
          )
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ((SELECT "q"."Name" FROM "q"), $4, $5)
          RETURNING ${UserSelectAll}
        `,
        ['name', 'key', 'password', 'key', 'password'],
      );
    });

    it('should not call `encode` with undefined', () => {
      const table = testDb(
        'table',
        (t) => ({
          id: t.identity().primaryKey(),
          key: t.text(),
          value: t
            .integer()
            .encode(() => 'encoded')
            .nullable(),
        }),
        undefined,
        {
          schema: () => 'schema',
        },
      );

      const q = table.create({ key: 'key', value: undefined });

      expectSql(
        q.toSQL(),
        `INSERT INTO "schema"."table"("key") VALUES ($1) RETURNING *`,
        ['key'],
      );
    });

    it('should not call `encode` with undefined', () => {
      const table = testDb(
        'table',
        (t) => ({
          id: t.identity().primaryKey(),
          value: t
            .integer()
            .encode(() => 'encoded')
            .nullable(),
        }),
        undefined,
        {
          schema: () => 'schema',
        },
      );

      const q = table.create({ value: null });

      expectSql(
        q.toSQL(),
        `INSERT INTO "schema"."table"("value") VALUES ($1) RETURNING *`,
        [null],
      );
    });

    it('should create using values from CTE', async () => {
      const q = db.user
        .with('created1', () =>
          db.user
            .create({
              Name: 'user 1',
              UserKey: 'key 1',
              Password: 'password 1',
            })
            .select('Name'),
        )
        .with('created2', () =>
          db.user
            .create({
              Name: 'user 2',
              UserKey: 'key 2',
              Password: 'password 2',
            })
            .select('Password'),
        )
        .create({
          Name: (q) => q.from('created1').get('Name'),
          UserKey: 'key',
          Password: (q) => q.from('created2').get('Password'),
        })
        .select('Name', 'Password');

      expectSql(
        q.toSQL(),
        `
          WITH "created1" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") VALUES ($1, $2, $3) RETURNING "User"."name" "Name"
          ),
          "created2" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") VALUES ($4, $5, $6) RETURNING "User"."password" "Password"
          )
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES (
            (SELECT "created1"."Name" FROM "created1" LIMIT 1),
            $7,
            (SELECT "created2"."Password" FROM "created2" LIMIT 1)
          )
          RETURNING "User"."name" "Name", "User"."password" "Password"
        `,
        [
          'user 1',
          'key 1',
          'password 1',
          'user 2',
          'key 2',
          'password 2',
          'key',
        ],
      );

      const res = await q;

      expect(res).toEqual({ Name: 'user 1', Password: 'password 2' });
    });
  });

  describe('insert', () => {
    it('should return row count by default', async () => {
      const q = db.user.insert(minUserData);

      const result = await q;

      assertType<typeof result, number>();

      expect(result).toBe(1);
    });

    it('should return selected columns', async () => {
      const result = await db.user.select('Name').insert(minUserData);

      assertType<typeof result, { Name: string }>();

      expect(result).toEqual({ Name: UserData.Name });
    });

    it('should support appending select', async () => {
      const result = await db.user.insert(minUserData).select('Name');

      assertType<typeof result, { Name: string }>();

      expect(result).toEqual({ Name: UserData.Name });
    });

    it('should return a single selected value', async () => {
      const result = await db.user.get('Name').insert(minUserData);

      assertType<typeof result, string>();

      expect(result).toBe(UserData.Name);
    });

    it('should support appending get', async () => {
      const result = await db.user.insert(minUserData).get('Name');

      assertType<typeof result, string>();

      expect(result).toBe(UserData.Name);
    });

    it('should not encode value when it is an expression', () => {
      // json column has an encoder, and it shouldn't run for a raw expression
      const q = db.user.insert({
        ...minUserData,
        Data: () => sql`'{"key":"value"}'`,
      });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "data")
          VALUES ($1, $2, $3, '{"key":"value"}')
        `,
        ['name', 'key', 'password'],
      );
    });

    it('should treat null as a database NULL even for JSON column', () => {
      const q = db.user.insert({ ...minUserData, Data: null });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "data")
          VALUES ($1, $2, $3, $4)
        `,
        ['name', 'key', 'password', null],
      );
    });

    it('should not make an empty RETURNING because it is not valid SQL', async () => {
      const q = db.user.insert(minUserData).select();

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, $3)
        `,
        ['name', 'key', 'password'],
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
      expect(await db.user.createMany([])).toEqual([]);
    });

    it('should create many records with raw SQL for a column value, should parse values', async () => {
      const q = db.user.createMany([
        {
          Name: UserData.Name,
          UserKey: UserData.UserKey,
          Password: () => sql<string>`'password'`,
        },
        {
          Name: () => sql<string>`'name'`,
          UserKey: UserData.UserKey,
          Password: UserData.Password,
        },
      ]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, 'password'), ('name', $3, $4)
          RETURNING ${UserSelectAll}
        `,
        [UserData.Name, UserData.UserKey, UserData.UserKey, UserData.Password],
      );

      const res = await q;

      assertType<typeof res, UserDefaultSelect[]>();

      expect(res).toMatchObject([
        { updatedAt: expect.any(Date) },
        { updatedAt: expect.any(Date) },
      ]);
    });

    it('should create many records, returning inserted count', async () => {
      const q = db.user.all();

      const arr = [
        {
          ...minUserData,
          Picture: null,
        },
        minUserData,
      ];

      const query = q.insertMany(arr);

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "picture")
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, DEFAULT)
      `,
        ['name', 'key', 'password', null, 'name', 'key', 'password'],
      );

      const result = await query;
      expect(result).toBe(2);

      assertType<typeof result, number>();

      const inserted = await db.user.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['Password']));
      });

      expectQueryNotMutated(q);
    });

    it('should create many records, returning columns', async () => {
      const q = db.user.all();

      const arr = [
        {
          ...minUserData,
          Picture: null,
        },
        minUserData,
      ];

      const query = q.select('Id', 'Name').createMany(arr);

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "picture")
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, DEFAULT)
        RETURNING "User"."id" "Id", "User"."name" "Name"
      `,
        ['name', 'key', 'password', null, 'name', 'key', 'password'],
      );

      const result = await query;
      assertType<typeof result, { Id: number; Name: string }[]>();

      const inserted = await db.user.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['Password']));
      });

      expectQueryNotMutated(q);
    });

    it('should support appending select', async () => {
      const result = await db.user
        .createMany([minUserData, minUserData])
        .select('Id', 'Name');

      assertType<typeof result, { Id: number; Name: string }[]>();

      expect(result).toEqual([
        { Id: expect.any(Number), Name: UserData.Name },
        { Id: expect.any(Number), Name: UserData.Name },
      ]);
    });

    it('should create many records, returning all columns', async () => {
      const q = db.user.all();

      const arr = [
        {
          ...minUserData,
          Picture: null,
        },
        minUserData,
      ];

      const query = q.createMany(arr);

      expectSql(
        query.toSQL(),
        `
        INSERT INTO "schema"."user" AS "User"("name", "user_key", "password", "picture")
        VALUES
          ($1, $2, $3, $4),
          ($5, $6, $7, DEFAULT)
        RETURNING ${UserSelectAll}
      `,
        ['name', 'key', 'password', null, 'name', 'key', 'password'],
      );

      const result = await query;
      result.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['Password']));
      });

      assertType<typeof result, UserDefaultSelect[]>();

      const inserted = await db.user.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(omit(arr[i], ['Password']));
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
          INSERT INTO "schema"."user" AS "User"("password", "name")
          VALUES ($1, $2), ($3, $4)
          RETURNING *
        `,
        ['one', 'runtime text', 'two', 'runtime text'],
      );
    });

    it('should strip unknown keys', () => {
      const query = db.user.createMany([
        {
          Name: 'name',
          UserKey: 'key',
          Password: 'password',
          unknown: 'should be stripped',
        },
        {
          Name: 'name',
          UserKey: 'key',
          Password: 'password',
          unknown: 'should be stripped',
        },
      ] as unknown as (typeof db.user.__inputType)[]);

      expectSql(
        query.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ($1, $2, $3), ($4, $5, $6)
          RETURNING ${UserSelectAll}
        `,
        ['name', 'key', 'password', 'name', 'key', 'password'],
      );
    });

    it('should create records with a sub query result for the column value', () => {
      const q = db.user.createMany([
        {
          Name: () => db.user.get('Name'),
          UserKey: 'key',
          Password: 'password',
        },
      ]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES ((SELECT "User"."name" FROM "schema"."user" "User" LIMIT 1), $1, $2)
          RETURNING ${UserSelectAll}
        `,
        ['key', 'password'],
      );
    });

    it('should create records with a sub query result from inserting', async () => {
      const q = db.user.createMany(
        Array.from({ length: 2 }, () => ({
          ...minUserData,
          Name: () => db.user.create(minUserData).get('Name'),
        })),
      );

      expectSql(
        q.toSQL(),
        `
          WITH "q" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            RETURNING "User"."name" "Name"
          ), "q2" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($6, $7, $8)
            RETURNING "User"."name" "Name"
          )
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES
            ((SELECT "q"."Name" FROM "q"), $4, $5),
            ((SELECT "q2"."Name" FROM "q2"), $9, $10)
          RETURNING ${UserSelectAll}
        `,
        [
          'name',
          'key',
          'password',
          'key',
          'password',
          'name',
          'key',
          'password',
          'key',
          'password',
        ],
      );
    });

    it('should override value return type with pluck', () => {
      const q = db.user.get('Name').createMany([minUserData]);

      assertType<Awaited<typeof q>, string[]>();
    });

    it('should create multiple empty records', () => {
      const table = testDb(
        'table',
        (t) => ({
          id: t.identity().primaryKey(),
        }),
        undefined,
        {
          schema: () => 'schema',
        },
      );

      const q = table.createMany([{}, {}, {}]);

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."table"("id")
          VALUES (DEFAULT), (DEFAULT), (DEFAULT)
          RETURNING *
        `,
      );
    });

    it('should not call `encode` with undefined', () => {
      setMaxBindingParams(6);

      const table = testDb(
        'table',
        (t) => ({
          id: t.identity().primaryKey(),
          key: t.text(),
          value: t
            .integer()
            .encode(() => 'encoded')
            .nullable(),
        }),
        undefined,
        {
          schema: () => 'schema',
        },
      );

      const q = table.createMany([
        { key: 'key', value: 1 },
        { key: 'key' },
        { key: 'key', value: 1 },
        { key: 'key' },
      ]);

      expectSql(
        q.toSQL(),
        `INSERT INTO "schema"."table"("key", "value") VALUES ($1, $2), ($3, DEFAULT), ($4, $5), ($6, DEFAULT) RETURNING *`,
        ['key', 'encoded', 'key', 'key', 'encoded', 'key'],
      );
    });

    describe('auto-batching lots of value groups', () => {
      it('should split large insert into batches', () => {
        setMaxBindingParams(5);
        const q = db.tag.insertMany(
          Array.from({ length: 12 }, (_, i) => ({
            Tag: `${i}`,
          })),
        );

        const sql = q.toSQL();
        expect(sql).toEqual({
          batch: [
            {
              text: `INSERT INTO "schema"."tag" AS "Tag"("tag") VALUES ($1), ($2), ($3), ($4), ($5)`,
              values: ['0', '1', '2', '3', '4'],
            },
            {
              text: `INSERT INTO "schema"."tag" AS "Tag"("tag") VALUES ($1), ($2), ($3), ($4), ($5)`,
              values: ['5', '6', '7', '8', '9'],
            },
            {
              text: `INSERT INTO "schema"."tag" AS "Tag"("tag") VALUES ($1), ($2)`,
              values: ['10', '11'],
            },
          ],
        });
      });

      it('should support batching inserts with `with` CTEs', () => {
        setMaxBindingParams(5);
        const q = db.tag.insertMany(
          Array.from({ length: 6 }, (_, i) => ({
            Tag: () => db.tag.create({ Tag: `${i}` }).get('Tag'),
          })),
        );

        const sql = q.toSQL();
        const insert = (i: number) =>
          `INSERT INTO "schema"."tag" AS "Tag"("tag") VALUES ($${i}) RETURNING "Tag"."tag" "Tag"`;
        expect(sql).toMatchObject({
          batch: [
            {
              text:
                `WITH "q" AS (${insert(1)}), "q2" AS (${insert(
                  2,
                )}), "q3" AS (${insert(3)}), "q4" AS (${insert(
                  4,
                )}), "q5" AS (${insert(5)}) ` +
                'INSERT INTO "schema"."tag" AS "Tag"("tag") VALUES ' +
                '((SELECT "q"."Tag" FROM "q")), ((SELECT "q2"."Tag" FROM "q2")), ((SELECT "q3"."Tag" FROM "q3")), ' +
                '((SELECT "q4"."Tag" FROM "q4")), ((SELECT "q5"."Tag" FROM "q5"))',
              values: ['0', '1', '2', '3', '4'],
            },
            {
              text: `WITH "q" AS (${insert(
                1,
              )}) INSERT INTO "schema"."tag" AS "Tag"("tag") VALUES ((SELECT "q"."Tag" FROM "q"))`,
              values: ['5'],
            },
          ],
        });
      });

      it('should throw when too many values for single insert group', () => {
        setMaxBindingParams(6);

        const q = db.user.insertMany([
          {
            Id: 1,
            Name: 'name',
            UserKey: 'key',
            Password: 'password',
            Picture: 'picture',
            Data: null,
            Age: 25,
          },
        ]);

        expect(() => q.toSQL()).toThrow(
          'Too many parameters for a single insert row',
        );
      });
    });

    it('should create many using values from CTE', async () => {
      const q = db.user
        .with('created1', () =>
          db.user
            .create({
              Name: 'user 1',
              UserKey: 'key 1',
              Password: 'password 1',
            })
            .select('Name', 'Password'),
        )
        .with('created2', () =>
          db.user
            .create({
              Name: 'user 2',
              UserKey: 'key 2',
              Password: 'password 2',
            })
            .select('Name', 'Password'),
        )
        .createMany([
          {
            Name: (q) => q.from('created1').get('Name'),
            UserKey: 'key',
            Password: (q) => q.from('created2').get('Password'),
          },
          {
            Name: (q) => q.from('created2').get('Name'),
            UserKey: 'key',
            Password: (q) => q.from('created1').get('Password'),
          },
        ])
        .select('Name', 'Password');

      expectSql(
        q.toSQL(),
        `
          WITH "created1" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") VALUES ($1, $2, $3) RETURNING "User"."name" "Name", "User"."password" "Password"
          ),
          "created2" AS (
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password") VALUES ($4, $5, $6) RETURNING "User"."name" "Name", "User"."password" "Password"
          )
          INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
          VALUES (
            (SELECT "created1"."Name" FROM "created1" LIMIT 1),
            $7,
            (SELECT "created2"."Password" FROM "created2" LIMIT 1)
          ), (
            (SELECT "created2"."Name" FROM "created2" LIMIT 1),
            $8,
            (SELECT "created1"."Password" FROM "created1" LIMIT 1)
          )
          RETURNING "User"."name" "Name", "User"."password" "Password"
        `,
        [
          'user 1',
          'key 1',
          'password 1',
          'user 2',
          'key 2',
          'password 2',
          'key',
          'key',
        ],
      );

      const res = await q;

      expect(res).toEqual([
        { Name: 'user 1', Password: 'password 2' },
        { Name: 'user 2', Password: 'password 1' },
      ]);
    });

    it('should fail in batch mode when there is a non-select query in CTE', async () => {
      setMaxBindingParams(5);
      const q = db.user
        .with('created', () =>
          db.user
            .create({
              Name: 'user 1',
              UserKey: 'key 1',
              Password: 'password 1',
            })
            .select('Name', 'Password'),
        )
        .createMany([
          {
            Name: 'first',
            Age: 20,
            UserKey: 'key',
            Password: (q) => q.from('created').get('Password'),
          },
          {
            Name: 'second',
            Age: 30,
            UserKey: 'key',
            Password: (q) => q.from('created').get('Password'),
          },
          {
            Name: 'third',
            Age: 40,
            UserKey: 'key',
            Password: (q) => q.from('created').get('Password'),
          },
        ])
        .select('Name', 'Password');

      expect(() => q.toSQL()).toThrow(
        'Cannot insert many records when having a non-select sub-query',
      );
    });
  });

  describe('insertMany', () => {
    it('should do nothing and return 0 when empty array is given', async () => {
      expect(await db.user.insertMany([])).toBe(0);
    });

    it('should return row count by default', async () => {
      const result = await db.user.insertMany([minUserData, minUserData]);

      assertType<typeof result, number>();

      expect(result).toBe(2);
    });

    it('should return records with selected columns', async () => {
      const result = await db.user
        .select('Name')
        .insertMany([minUserData, minUserData]);

      assertType<typeof result, { Name: string }[]>();

      expect(result).toEqual([
        { Name: UserData.Name },
        { Name: UserData.Name },
      ]);
    });

    it('should support appending select', async () => {
      const result = await db.user
        .insertMany([minUserData, minUserData])
        .select('Name');

      assertType<typeof result, { Name: string }[]>();

      expect(result).toEqual([
        { Name: UserData.Name },
        { Name: UserData.Name },
      ]);
    });

    it('should override single returning value with multiple', async () => {
      const result = await db.user
        .get('Name')
        .insertMany([minUserData, minUserData]);

      assertType<typeof result, string[]>();

      expect(result).toEqual([UserData.Name, UserData.Name]);
    });
  });

  describe('onConflict', () => {
    it('should accept where condition for merge', () => {
      const q = db.user.all();

      const query = q
        .select('Id')
        .create(minUserData)
        .onConflict('Id')
        .merge()
        .where({ Name: 'where name' });

      expectSql(
        query.toSQL(),
        `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($2, $3, $4)
            ON CONFLICT ("id")
            DO UPDATE SET "name" = excluded."name", "user_key" = excluded."user_key", "password" = excluded."password"
            WHERE "User"."name" = $1
            RETURNING "User"."id" "Id"
          `,
        ['where name', 'name', 'key', 'password'],
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
        {
          schema: () => 'schema',
        },
      );

      const q = table
        .insert({ name: 'name', password: 'password' })
        .onConflictDoNothing({
          constraint: 'pkey',
        });

      expectSql(
        q.toSQL(),
        `
          INSERT INTO "schema"."table"("name", "password")
          VALUES ($1, $2)
          ON CONFLICT ON CONSTRAINT "pkey" DO NOTHING
        `,
        ['name', 'password'],
      );
    });

    describe('ignore', () => {
      it('should not append soft delete scope as WHERE', () => {
        const query = db.message
          .insert({
            MessageKey: 'key',
            ChatId: 1,
            Text: UserData.Name,
          })
          .onConflictDoNothing();

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."message" AS "Message"("message_key", "chat_id", "text")
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          ['key', 1, UserData.Name],
        );
      });

      it('should perform `ON CONFLICT` without a target', () => {
        const q = db.user.all();

        const query = q.insert(minUserData).onConflictDoNothing();
        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `,
          ['name', 'key', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = db.user.all();

        const query = q.insert(minUserData).onConflictDoNothing('Id');
        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id") DO NOTHING
          `,
          ['name', 'key', 'password'],
        );

        expectQueryNotMutated(q);
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
          {
            schema: () => 'schema',
          },
        );

        const q = table
          .count()
          .create({ name: 'name', password: 'password' })
          .onConflictDoNothing(['id', 'name']);

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."table"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("id", "name") DO NOTHING
          `,
          ['name', 'password'],
        );
      });

      it('can accept raw query', () => {
        const q = db.user.all();

        const query = q
          .count()
          .create(minUserData)
          .onConflictDoNothing(sql`raw query`);

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT raw query DO NOTHING
          `,
          ['name', 'key', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should override query return type from oneOrThrow to one', async () => {
        await db.uniqueTable.create(uniqueTableData);

        const q = db.uniqueTable
          .take()
          .create(uniqueTableData)
          .onConflictDoNothing();

        const result = await q;

        assertType<
          typeof result,
          typeof db.uniqueTable.__outputType | undefined
        >();

        expect(result).toBe(undefined);
      });

      it('should override query return type from valueOrThrow to value', async () => {
        await db.uniqueTable.create(uniqueTableData);

        const q = db.uniqueTable
          .get('id')
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
        const q = db.user.all();

        const query = q
          .count()
          .create(minUserData)
          .onConflict('Id')
          .set({ Name: 'new name' });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($2, $3, $4)
            ON CONFLICT ("id")
            DO UPDATE SET "name" = $1
          `,
          ['new name', 'name', 'key', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept raw sql', () => {
        const q = db.user.all();

        const query = q
          .count()
          .create(minUserData)
          .onConflict(sql`on conflict raw`)
          .set({
            Name: () => sql`${'new name'}`,
          });

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($2, $3, $4)
            ON CONFLICT on conflict raw
            DO UPDATE SET "name" = $1
          `,
          ['new name', 'name', 'key', 'password'],
        );

        expectQueryNotMutated(q);
      });
    });

    describe('merge', () => {
      it(`should merge all columns except onConflict's column`, () => {
        const q = db.user.insert(minUserData).onConflict('Id').merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id")
            DO UPDATE SET "name" = excluded."name", "user_key" = excluded."user_key", "password" = excluded."password"
          `,
          ['name', 'key', 'password'],
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
          {
            schema: () => 'schema',
          },
        );

        const q = table
          .insert({ id: 1, name: 'name', password: 'password' })
          .onConflict(['id', 'name'])
          .merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."table"("id", "name", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id", "name")
            DO UPDATE SET "password" = excluded."password"
          `,
          [1, 'name', 'password'],
        );
      });

      it('should DO NOTHING if all columns are excluded', () => {
        const q = db.user
          .insert({
            Name: 'name',
            Password: undefined as never,
          } as unknown as typeof db.user.__inputType)
          .onConflict('Id')
          .merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name")
            VALUES ($1)
            ON CONFLICT ("id")
            DO UPDATE SET "name" = excluded."name"
          `,
          ['name'],
        );
      });

      it('should accept single column', () => {
        const q = db.user.all();

        const query = q
          .count()
          .create(minUserData)
          .onConflict('Id')
          .merge('Name');

        expectSql(
          query.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("name", "user_key", "password")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id")
            DO UPDATE SET "name" = excluded."name"
          `,
          ['name', 'key', 'password'],
        );

        expectQueryNotMutated(q);
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
          {
            schema: () => 'schema',
          },
        );

        const q = table
          .count()
          .create({ name: 'name', password: 'password' })
          .onConflict(['id', 'name'])
          .merge(['name', 'password']);

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."table"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("id", "name")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password"
          `,
          ['name', 'password'],
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
          {
            schema: () => 'schema',
          },
        );

        const q = table
          .count()
          .create({ name: 'name', password: 'password' })
          .onConflict(['id', 'name'])
          .merge({ except: 'hasDefault' });

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."table"("name", "password", "has_default")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id", "name")
            DO UPDATE SET "password" = excluded."password"
          `,
          ['name', 'password', 'default'],
        );
      });

      it('should not merge runtime default columns', async () => {
        const q = RuntimeDefaultTable.insert({ password: 'password' })
          .onConflict('id')
          .merge();

        expectSql(
          q.toSQL(),
          `
            INSERT INTO "schema"."user" AS "User"("password", "name")
            VALUES ($1, $2)
            ON CONFLICT ("id")
            DO UPDATE SET "password" = excluded."password"
          `,
          ['password', 'runtime text'],
        );
      });
    });
  });
});
