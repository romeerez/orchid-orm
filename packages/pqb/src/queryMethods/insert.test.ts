import {
  AssertEqual,
  expectMatchObjectWithTimestamps,
  expectQueryNotMutated,
  line,
  User,
  useTestDatabase,
} from '../test-utils';
import { quote } from '../quote';
import { raw } from '../common';
import { OnConflictQueryBuilder } from './insert';

describe('insert', () => {
  useTestDatabase();

  const now = new Date();
  const data = {
    name: 'name',
    password: 'password',
    createdAt: now,
    updatedAt: now,
  };

  it('should insert one record, returning void', async () => {
    const q = User.all();

    const query = q.insert(data);
    expect(query.toSql()).toBe(
      line(`
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
        VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
      `),
    );

    const result = await query;
    const isVoid: AssertEqual<typeof result, void> = true;
    expect(isVoid).toBe(true);

    const inserted = await User.take();
    expectMatchObjectWithTimestamps(inserted, data);

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning columns', async () => {
    const q = User.all();

    const query = q.insert(data, ['id', 'name', 'createdAt', 'updatedAt']);
    expect(query.toSql()).toBe(
      line(`
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
        VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
        RETURNING "user"."id", "user"."name", "user"."createdAt", "user"."updatedAt"
      `),
    );

    const result = await query;
    const eq: AssertEqual<
      typeof result,
      { id: number; name: string; createdAt: Date; updatedAt: Date }
    > = true;
    expect(eq).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...other } = data;
    expectMatchObjectWithTimestamps(result, other);

    expectQueryNotMutated(q);
  });

  it('should insert many records, returning void', async () => {
    const q = User.all();

    const arr = [
      {
        ...data,
        picture: null,
      },
      data,
    ];

    const query = q.insert(arr);

    expect(query.toSql()).toBe(
      line(`
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt", "picture")
        VALUES
          ('name', 'password', ${quote(now)}, ${quote(now)}, NULL),
          ('name', 'password', ${quote(now)}, ${quote(now)}, DEFAULT)
      `),
    );

    const result = await query;
    const isVoid: AssertEqual<typeof result, void> = true;
    expect(isVoid).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expectMatchObjectWithTimestamps(item, arr[i]);
    });

    expectQueryNotMutated(q);
  });

  it('should insert many records, returning columns', async () => {
    const q = User.all();

    const arr = [
      {
        ...data,
        picture: null,
      },
      data,
    ];

    const query = q.insert(arr, ['id', 'name', 'createdAt', 'updatedAt']);

    expect(query.toSql()).toBe(
      line(`
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt", "picture")
        VALUES
          ('name', 'password', ${quote(now)}, ${quote(now)}, NULL),
          ('name', 'password', ${quote(now)}, ${quote(now)}, DEFAULT)
        RETURNING "user"."id", "user"."name", "user"."createdAt", "user"."updatedAt"
      `),
    );

    const result = await query;
    const eq: AssertEqual<
      typeof result,
      { id: number; name: string; createdAt: Date; updatedAt: Date }[]
    > = true;
    expect(eq).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expectMatchObjectWithTimestamps(item, arr[i]);
    });

    expectQueryNotMutated(q);
  });

  describe('onConflict', () => {
    it('should return special query builder and return previous after ignore or merge', () => {
      const q = User.all();

      const originalQuery = q.insert(data);
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

    describe('ignore', () => {
      it('should set `ON CONFLICT` to all columns if no arguments provided', () => {
        const q = User.all();

        const query = q.insert(data).onConflict().ignore();
        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("name", "password", "createdAt", "updatedAt")
            DO NOTHING
          `),
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(data).onConflict('id').ignore();
        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("id") DO NOTHING
          `),
        );

        expectQueryNotMutated(q);
      });

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q.insert(data).onConflict(['id', 'name']).ignore();
        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("id", "name") DO NOTHING
          `),
        );

        expectQueryNotMutated(q);
      });

      it('can accept raw query', () => {
        const q = User.all();

        const query = q.insert(data).onConflict(raw('raw query')).ignore();
        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT (raw query) DO NOTHING
          `),
        );

        expectQueryNotMutated(q);
      });
    });

    describe('merge', () => {
      it('should update all columns when calling without arguments', () => {
        const q = User.all();

        const query = q.insert(data).onConflict().merge();
        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("name", "password", "createdAt", "updatedAt")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password",
              "createdAt" = excluded."createdAt",
              "updatedAt" = excluded."updatedAt"
          `),
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(data).onConflict('name').merge('name');
        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("name")
            DO UPDATE SET "name" = excluded."name"
          `),
        );

        expectQueryNotMutated(q);
      });

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q
          .insert(data)
          .onConflict(['name', 'password'])
          .merge(['name', 'password']);

        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("name", "password")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password"
          `),
        );

        expectQueryNotMutated(q);
      });

      it('should accept object with values to update', () => {
        const q = User.all();

        const query = q
          .insert(data)
          .onConflict('name')
          .merge({ name: 'new name' });

        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("name")
            DO UPDATE SET "name" = 'new name'
          `),
        );

        expectQueryNotMutated(q);
      });

      it.only('should accept where condition', () => {
        const q = User.all();

        const query = q
          .insert(data, ['id'])
          .onConflict('name')
          .merge({ name: 'new name' })
          .where({ name: 'where name' });

        expect(query.toSql()).toBe(
          line(`
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ('name', 'password', ${quote(now)}, ${quote(now)})
            ON CONFLICT ("name")
            DO UPDATE SET "name" = 'new name'
            WHERE "user"."name" = 'where name'
            RETURNING "user"."id"
          `),
        );

        expectQueryNotMutated(q);
      });
    });
  });
});
