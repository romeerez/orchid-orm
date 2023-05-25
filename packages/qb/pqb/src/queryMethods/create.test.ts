import {
  Chat,
  expectQueryNotMutated,
  Message,
  MessageRecord,
  Snake,
  snakeData,
  SnakeRecord,
  snakeSelectAll,
  User,
  userData,
  UserRecord,
} from '../test-utils/test-utils';
import { OnConflictQueryBuilder } from './create';
import { assertType, expectSql, testDb, useTestDatabase } from 'test-utils';

const RuntimeDefaultTable = testDb('user', (t) => ({
  id: t.serial().primaryKey(),
  name: t.text().default(() => 'runtime text'),
  password: t.text(),
}));

describe('create functions', () => {
  useTestDatabase();

  describe('createRaw', () => {
    it('should create with raw sql and list of columns', () => {
      const q = User.all();

      const query = q.createRaw({
        columns: ['name', 'password'],
        values: testDb.sql`raw sql`,
      });

      expectSql(
        query.toSql(),
        `
          INSERT INTO "user"("name", "password")
          VALUES (raw sql)
          RETURNING *
        `,
      );

      assertType<Awaited<typeof query>, UserRecord>();

      expectQueryNotMutated(q);
    });

    it('should add runtime default', () => {
      const q = RuntimeDefaultTable.createRaw({
        columns: ['password'],
        values: testDb.sql`'password'`,
      });

      expectSql(
        q.toSql(),
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
        values: testDb.sql`raw sql`,
      });
      expectSql(
        query.toSql(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES (raw sql)
          RETURNING ${snakeSelectAll}
        `,
      );
    });
  });

  describe('createManyRaw', () => {
    it('should create with raw sql and list of columns', () => {
      const q = User.all();

      const query = q.createManyRaw({
        columns: ['name', 'password'],
        values: [testDb.sql`sql1`, testDb.sql`sql2`],
      });
      expectSql(
        query.toSql(),
        `
          INSERT INTO "user"("name", "password")
          VALUES (sql1), (sql2)
          RETURNING *
        `,
      );

      assertType<Awaited<typeof query>, UserRecord[]>();

      expectQueryNotMutated(q);
    });

    it('should add runtime default', () => {
      const q = RuntimeDefaultTable.createManyRaw({
        columns: ['password'],
        values: [testDb.sql`'pw1'`, testDb.sql`'pw2'`],
      });

      expectSql(
        q.toSql(),
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
        values: [testDb.sql`sql1`, testDb.sql`sql2`],
      });
      expectSql(
        query.toSql(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES (sql1), (sql2)
          RETURNING ${snakeSelectAll}
        `,
      );
    });
  });

  describe('create', () => {
    it('should create one record, returning record', async () => {
      const q = User.all();

      const query = q.create(userData);
      expectSql(
        query.toSql(),
        `
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
        RETURNING *
      `,
        ['name', 'password'],
      );

      const result = await query;
      expect(result).toMatchObject(userData);

      assertType<typeof result, UserRecord>();

      const created = await User.take();
      expect(created).toMatchObject(userData);

      expectQueryNotMutated(q);
    });

    it('should create one record with named columns, returning record', async () => {
      const query = Snake.create(snakeData);

      expectSql(
        query.toSql(),
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
        query.toSql(),
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
        query.toSql(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES ($1, $2)
          RETURNING "snake"."snake_name" AS "snakeName"
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
        query.toSql(),
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

    it('should create one record, returning named columns', async () => {
      const query = Snake.select('snakeName', 'tailLength').create(snakeData);
      expectSql(
        query.toSql(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          VALUES ($1, $2)
          RETURNING "snake"."snake_name" AS "snakeName", "snake"."tail_length" AS "tailLength"
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

      const query = q.count().create(userData);
      expectSql(
        query.toSql(),
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
        q.toSql(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
          RETURNING *
        `,
        ['name', 'override'],
      );
    });

    it('should strip unknown keys', () => {
      const q = User.create({
        name: 'name',
        password: 'password',
        unknown: 'should be stripped',
      } as unknown as UserRecord);

      expectSql(
        q.toSql(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2)
          RETURNING *
        `,
        ['name', 'password'],
      );
    });

    it('should create record with runtime default', () => {
      const q = RuntimeDefaultTable.create({
        password: 'password',
      });

      expectSql(
        q.toSql(),
        `
          INSERT INTO "user"("password", "name")
          VALUES ($1, $2)
          RETURNING *
        `,
        ['password', 'runtime text'],
      );
    });
  });

  describe('createMany', () => {
    it('should create many records, returning inserted count', async () => {
      const q = User.all();

      const arr = [
        {
          ...userData,
          picture: null,
        },
        userData,
      ];

      const query = q.count().createMany(arr);

      expectSql(
        query.toSql(),
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
        expect(item).toMatchObject(arr[i]);
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
        query.toSql(),
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
        expect(item).toMatchObject(arr[i]);
      });

      expectQueryNotMutated(q);
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
        query.toSql(),
        `
        INSERT INTO "user"("name", "password", "picture")
        VALUES
          ($1, $2, $3),
          ($4, $5, DEFAULT)
        RETURNING *
      `,
        ['name', 'password', null, 'name', 'password'],
      );

      const result = await query;
      result.forEach((item, i) => {
        expect(item).toMatchObject(arr[i]);
      });

      assertType<typeof result, (typeof User)['type'][]>();

      const inserted = await User.all();
      inserted.forEach((item, i) => {
        expect(item).toMatchObject(arr[i]);
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
        q.toSql(),
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
      ] as unknown as UserRecord[]);

      expectSql(
        query.toSql(),
        `
          INSERT INTO "user"("name", "password")
          VALUES ($1, $2), ($3, $4)
          RETURNING *
        `,
        ['name', 'password', 'name', 'password'],
      );
    });
  });

  describe('createFrom', () => {
    it('should create records without additional data', () => {
      const q = Message.createFrom(Chat.find(1).select({ chatId: 'idOfChat' }));

      assertType<Awaited<typeof q>, MessageRecord>();

      expectSql(
        q.toSql(),
        `
          INSERT INTO "message"("chatId")
          SELECT "chat"."idOfChat" AS "chatId"
          FROM "chat"
          WHERE "chat"."idOfChat" = $1
          LIMIT $2
          RETURNING *
        `,
        [1, 1],
      );
    });

    it('should create record from select', () => {
      const chat = Chat.find(1).select({ chatId: 'idOfChat' });

      const query = Message.createFrom(chat, {
        authorId: 1,
        text: 'text',
      });

      assertType<Awaited<typeof query>, MessageRecord>();

      expectSql(
        query.toSql(),
        `
          INSERT INTO "message"("chatId", "authorId", "text")
          SELECT "chat"."idOfChat" AS "chatId", $1, $2
          FROM "chat"
          WHERE "chat"."idOfChat" = $3
          LIMIT $4
          RETURNING *
        `,
        [1, 'text', 1, 1],
      );
    });

    it('should create record from select with named columns', () => {
      const user = User.find(1).select({ snakeName: 'name' });

      const query = Snake.createFrom(user, {
        tailLength: 5,
      });

      assertType<Awaited<typeof query>, SnakeRecord>();

      expectSql(
        query.toSql(),
        `
          INSERT INTO "snake"("snake_name", "tail_length")
          SELECT "user"."name" AS "snakeName", $1
          FROM "user"
          WHERE "user"."id" = $2
          LIMIT $3
          RETURNING ${snakeSelectAll}
        `,
        [5, 1, 1],
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
        q.toSql(),
        `
          INSERT INTO "user"("password", "id", "name")
          SELECT "user"."password", $1, $2
          FROM "user"
          WHERE "user"."id" = $3
          LIMIT $4
          RETURNING *
        `,
        [456, 'runtime text', 123, 1],
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
  });

  describe('createManyFrom', () => {
    it('should create records from select', () => {
      const query = Message.createManyFrom(
        Chat.where({ title: 'title' }).select({ chatId: 'idOfChat' }),
      );

      assertType<Awaited<typeof query>, MessageRecord[]>();

      expectSql(
        query.toSql(),
        `
          INSERT INTO "message"("chatId")
          SELECT "chat"."idOfChat" AS "chatId"
          FROM "chat"
          WHERE "chat"."title" = $1
          RETURNING *
        `,
        ['title'],
      );
    });

    it('should create record from select with named columns', () => {
      const query = Snake.createManyFrom(
        User.where({ name: 'name' }).select({ snakeName: 'name' }),
      );

      assertType<Awaited<typeof query>, SnakeRecord[]>();

      expectSql(
        query.toSql(),
        `
          INSERT INTO "snake"("snake_name")
          SELECT "user"."name" AS "snakeName"
          FROM "user"
          WHERE "user"."name" = $1
          RETURNING ${snakeSelectAll}
        `,
        ['name'],
      );
    });
  });

  describe('onConflict', () => {
    it('should return special query builder and return previous after ignore or merge', () => {
      const q = User.all();

      const originalQuery = q.count().create(userData);
      const onConflictQuery = q.onConflict();
      expect(originalQuery instanceof OnConflictQueryBuilder).not.toBe(true);
      expect(onConflictQuery instanceof OnConflictQueryBuilder).toBe(true);
      expect(onConflictQuery instanceof OnConflictQueryBuilder).toBe(true);
      expect(
        onConflictQuery.ignore() instanceof OnConflictQueryBuilder,
      ).not.toBe(true);
      expect(
        onConflictQuery.merge() instanceof OnConflictQueryBuilder,
      ).not.toBe(true);

      expectQueryNotMutated(q);
    });

    it('should accept where condition', () => {
      const q = User.all();

      const query = q
        .select('id')
        .create(userData)
        .onConflict('name')
        .ignore()
        .where({ name: 'where name' });

      expectSql(
        query.toSql(),
        `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name") DO NOTHING
            WHERE "user"."name" = $3
            RETURNING "user"."id"
          `,
        ['name', 'password', 'where name'],
      );

      expectQueryNotMutated(q);
    });

    describe('ignore', () => {
      it('should perform `ON CONFLICT` without a target', () => {
        const q = User.all();

        const query = q.count().create(userData).onConflict().ignore();
        expectSql(
          query.toSql(),
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

        const query = q.count().create(userData).onConflict('id').ignore();
        expectSql(
          query.toSql(),
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
          .onConflict('snakeName')
          .ignore();

        expectSql(
          query.toSql(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($1, $2)
            ON CONFLICT ("snake_name") DO NOTHING
          `,
          [snakeData.snakeName, snakeData.tailLength],
        );
      });

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict(['id', 'name'])
          .ignore();

        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("id", "name") DO NOTHING
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept multiple named columns', () => {
        const query = Snake.count()
          .create(snakeData)
          .onConflict(['snakeName', 'tailLength'])
          .ignore();

        expectSql(
          query.toSql(),
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
          .onConflict(testDb.sql`raw query`)
          .ignore();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT raw query DO NOTHING
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });
    });

    describe('merge', () => {
      it('should automatically list all unique columns when calling without arguments', () => {
        const User = testDb('user', (t) => ({
          id: t.serial().primaryKey(),
          name: t.text().unique(),
          password: t.text(),
          age: t.integer().nullable(),
          ...t.unique(['password']),
        }));

        const q = User.all();

        const query = q
          .count()
          .create({ ...userData, age: 20 })
          .onConflict()
          .merge();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "age")
            VALUES ($1, $2, $3)
            ON CONFLICT ("name", "password")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password",
              "age" = excluded."age"
          `,
          ['name', 'password', 20],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict('name')
          .merge('name');
        expectSql(
          query.toSql(),
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
          query.toSql(),
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
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict(['name', 'password'])
          .merge(['name', 'password']);

        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name", "password")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password"
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept multiple named columns', () => {
        const query = Snake.count()
          .create(snakeData)
          .onConflict(['snakeName', 'tailLength'])
          .merge(['snakeName', 'tailLength']);

        expectSql(
          query.toSql(),
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

      it('should accept object with values to update', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict('name')
          .merge({ name: 'new name' });

        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name")
            DO UPDATE SET "name" = $3
          `,
          ['name', 'password', 'new name'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept object with values to update for named column', () => {
        const query = Snake.count()
          .create(snakeData)
          .onConflict('snakeName')
          .merge({ snakeName: 'new name' });

        expectSql(
          query.toSql(),
          `
            INSERT INTO "snake"("snake_name", "tail_length")
            VALUES ($1, $2)
            ON CONFLICT ("snake_name")
            DO UPDATE SET "snake_name" = $3
          `,
          [snakeData.snakeName, snakeData.tailLength, 'new name'],
        );
      });

      it('should accept raw sql', () => {
        const q = User.all();

        const query = q
          .count()
          .create(userData)
          .onConflict(testDb.sql`on conflict raw`)
          .merge(testDb.sql`merge raw`);

        expectSql(
          query.toSql(),
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
  });
});
