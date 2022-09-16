import {
  AssertEqual,
  expectMatchObjectWithTimestamps,
  expectQueryNotMutated,
  expectSql,
  now,
  User,
  userData,
  useTestDatabase,
} from '../test-utils';
import { raw } from '../common';
import { OnConflictQueryBuilder } from './insert';

describe('insert', () => {
  useTestDatabase();

  it('should insert with raw sql and list of columns', () => {
    const q = User.all();

    const query = q.insert({
      columns: ['name', 'password'],
      values: raw('raw sql'),
    });
    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password")
        VALUES raw sql
      `,
    );

    const eq: AssertEqual<Awaited<typeof query>, number> = true;
    expect(eq).toBe(true);

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning rows count', async () => {
    const q = User.all();

    const query = q.insert(userData);
    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4)
      `,
      ['name', 'password', now, now],
    );

    const result = await query;
    expect(result).toBe(1);

    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

    const inserted = await User.take();
    expectMatchObjectWithTimestamps(inserted, userData);

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning columns', async () => {
    const q = User.all();

    const query = q
      .select('id', 'name', 'createdAt', 'updatedAt')
      .insert(userData);
    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4)
        RETURNING "user"."id", "user"."name", "user"."createdAt", "user"."updatedAt"
      `,
      ['name', 'password', now, now],
    );

    const result = await query;
    const eq: AssertEqual<
      typeof result,
      { id: number; name: string; createdAt: Date; updatedAt: Date }
    > = true;
    expect(eq).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...other } = userData;
    expectMatchObjectWithTimestamps(result, other);

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning all columns', async () => {
    const q = User.all();

    const query = q.selectAll().insert(userData);
    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      ['name', 'password', now, now],
    );

    const result = await query;
    const eq: AssertEqual<typeof result, typeof User['type']> = true;
    expect(eq).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...other } = userData;
    expectMatchObjectWithTimestamps(result, other);

    expectQueryNotMutated(q);
  });

  it('should insert many records, returning void', async () => {
    const q = User.all();

    const arr = [
      {
        ...userData,
        picture: null,
      },
      userData,
    ];

    const query = q.insert(arr);

    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt", "picture")
        VALUES
          ($1, $2, $3, $4, $5),
          ($6, $7, $8, $9, DEFAULT)
      `,
      ['name', 'password', now, now, null, 'name', 'password', now, now],
    );

    const result = await query;
    expect(result).toBe(2);

    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

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
        ...userData,
        picture: null,
      },
      userData,
    ];

    const query = q.select('id', 'name', 'createdAt', 'updatedAt').insert(arr);

    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt", "picture")
        VALUES
          ($1, $2, $3, $4, $5),
          ($6, $7, $8, $9, DEFAULT)
        RETURNING "user"."id", "user"."name", "user"."createdAt", "user"."updatedAt"
      `,
      ['name', 'password', now, now, null, 'name', 'password', now, now],
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

  it('should insert many records, returning all columns', async () => {
    const q = User.all();

    const arr = [
      {
        ...userData,
        picture: null,
      },
      userData,
    ];

    const query = q.selectAll().insert(arr);

    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "createdAt", "updatedAt", "picture")
        VALUES
          ($1, $2, $3, $4, $5),
          ($6, $7, $8, $9, DEFAULT)
        RETURNING *
      `,
      ['name', 'password', now, now, null, 'name', 'password', now, now],
    );

    const result = await query;
    result.forEach((item, i) => {
      expectMatchObjectWithTimestamps(item, arr[i]);
    });

    const eq: AssertEqual<typeof result, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expectMatchObjectWithTimestamps(item, arr[i]);
    });

    expectQueryNotMutated(q);
  });

  it('should insert record with provided defaults', () => {
    const query = User.defaults({
      name: 'name',
      password: 'password',
    }).insert({
      password: 'override',
      updatedAt: now,
      createdAt: now,
    });

    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password", "updatedAt", "createdAt")
        VALUES ($1, $2, $3, $4)
      `,
      ['name', 'override', now, now],
    );
  });

  describe('onConflict', () => {
    it('should return special query builder and return previous after ignore or merge', () => {
      const q = User.all();

      const originalQuery = q.insert(userData);
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
        .insert(userData)
        .onConflict('name')
        .ignore()
        .where({ name: 'where name' });

      expectSql(
        query.toSql(),
        `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name")
            DO NOTHING
            WHERE "user"."name" = $5
            RETURNING "user"."id"
          `,
        ['name', 'password', now, now, 'where name'],
      );

      expectQueryNotMutated(q);
    });

    describe('ignore', () => {
      it('should set `ON CONFLICT` to all columns if no arguments provided', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict().ignore();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name", "password", "createdAt", "updatedAt")
            DO NOTHING
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict('id').ignore();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("id") DO NOTHING
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict(['id', 'name']).ignore();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("id", "name") DO NOTHING
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });

      it('can accept raw query', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict(raw('raw query')).ignore();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT raw query DO NOTHING
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });
    });

    describe('merge', () => {
      it('should update all columns when calling without arguments', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict().merge();
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name", "password", "createdAt", "updatedAt")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password",
              "createdAt" = excluded."createdAt",
              "updatedAt" = excluded."updatedAt"
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict('name').merge('name');
        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name")
            DO UPDATE SET "name" = excluded."name"
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q
          .insert(userData)
          .onConflict(['name', 'password'])
          .merge(['name', 'password']);

        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name", "password")
            DO UPDATE SET
              "name" = excluded."name",
              "password" = excluded."password"
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });

      it('should accept object with values to update', () => {
        const q = User.all();

        const query = q
          .insert(userData)
          .onConflict('name')
          .merge({ name: 'new name' });

        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT ("name")
            DO UPDATE SET "name" = $5
          `,
          ['name', 'password', now, now, 'new name'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept raw sql', () => {
        const q = User.all();

        const query = q
          .insert(userData)
          .onConflict(raw('on conflict raw'))
          .merge(raw('merge raw'));

        expectSql(
          query.toSql(),
          `
            INSERT INTO "user"("name", "password", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4)
            ON CONFLICT on conflict raw
            DO UPDATE SET merge raw
          `,
          ['name', 'password', now, now],
        );

        expectQueryNotMutated(q);
      });
    });
  });

  describe('create', () => {
    it('should return full record', async () => {
      const result = await User.create(userData);
      expectMatchObjectWithTimestamps(result, userData);

      const eq: AssertEqual<typeof result, typeof User.type> = true;
      expect(eq).toBe(true);
    });

    it('should return columns from select', async () => {
      const result = await User.select('id', 'name').create(userData);
      expect(result).toEqual({
        id: result.id,
        name: userData.name,
      });

      const eq: AssertEqual<typeof result, { id: number; name: string }> = true;
      expect(eq).toBe(true);
    });

    it('should return full records when creating many', async () => {
      const result = await User.create([userData, userData]);
      expectMatchObjectWithTimestamps(result[0], userData);
      expectMatchObjectWithTimestamps(result[1], userData);

      const eq: AssertEqual<typeof result, typeof User.type[]> = true;
      expect(eq).toBe(true);
    });

    it('should return columns from select when creating many', async () => {
      const result = await User.select('id', 'name').create([
        userData,
        userData,
      ]);
      expect(result[0]).toEqual({
        id: result[0].id,
        name: userData.name,
      });
      expect(result[1]).toEqual({
        id: result[1].id,
        name: userData.name,
      });

      const eq: AssertEqual<typeof result, { id: number; name: string }[]> =
        true;
      expect(eq).toBe(true);
    });
  });
});
