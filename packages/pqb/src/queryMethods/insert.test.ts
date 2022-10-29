import {
  AssertEqual,
  expectQueryNotMutated,
  expectSql,
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
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
      `,
      ['name', 'password'],
    );

    const result = await query;
    expect(result).toBe(1);

    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

    const inserted = await User.take();
    expect(inserted).toMatchObject(userData);

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning value', async () => {
    const q = User.all();

    const query = q.get('id').insert(userData);
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
    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

    expect(typeof result).toBe('number');

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning columns', async () => {
    const q = User.all();

    const query = q.select('id', 'name').insert(userData);
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
    const eq: AssertEqual<typeof result, { id: number; name: string }> = true;
    expect(eq).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...other } = userData;
    expect(result).toMatchObject(other);

    expectQueryNotMutated(q);
  });

  it('should insert one record, returning all columns', async () => {
    const q = User.all();

    const query = q.selectAll().insert(userData);
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
    const eq: AssertEqual<typeof result, typeof User['type']> = true;
    expect(eq).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...other } = userData;
    expect(result).toMatchObject(other);

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
        INSERT INTO "user"("name", "password", "picture")
        VALUES
          ($1, $2, $3),
          ($4, $5, DEFAULT)
      `,
      ['name', 'password', null, 'name', 'password'],
    );

    const result = await query;
    expect(result).toBe(2);

    const eq: AssertEqual<typeof result, number> = true;
    expect(eq).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expect(item).toMatchObject(arr[i]);
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

    const query = q.select('id', 'name').insert(arr);

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
    const eq: AssertEqual<typeof result, { id: number; name: string }[]> = true;
    expect(eq).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expect(item).toMatchObject(arr[i]);
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

    const eq: AssertEqual<typeof result, typeof User['type'][]> = true;
    expect(eq).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expect(item).toMatchObject(arr[i]);
    });

    expectQueryNotMutated(q);
  });

  it('should insert record with provided defaults', () => {
    const query = User.defaults({
      name: 'name',
      password: 'password',
    }).insert({
      password: 'override',
    });

    expectSql(
      query.toSql(),
      `
        INSERT INTO "user"("name", "password")
        VALUES ($1, $2)
      `,
      ['name', 'override'],
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
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name")
            DO NOTHING
            WHERE "user"."name" = $3
            RETURNING "user"."id"
          `,
        ['name', 'password', 'where name'],
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
            INSERT INTO "user"("name", "password")
            VALUES ($1, $2)
            ON CONFLICT ("name", "password")
            DO NOTHING
          `,
          ['name', 'password'],
        );

        expectQueryNotMutated(q);
      });

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict('id').ignore();
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

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict(['id', 'name']).ignore();
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

      it('can accept raw query', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict(raw('raw query')).ignore();
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
      it('should update all columns when calling without arguments', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict().merge();
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

      it('should accept single column', () => {
        const q = User.all();

        const query = q.insert(userData).onConflict('name').merge('name');
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

      it('should accept multiple columns', () => {
        const q = User.all();

        const query = q
          .insert(userData)
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

      it('should accept object with values to update', () => {
        const q = User.all();

        const query = q
          .insert(userData)
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

      it('should accept raw sql', () => {
        const q = User.all();

        const query = q
          .insert(userData)
          .onConflict(raw('on conflict raw'))
          .merge(raw('merge raw'));

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

  describe('create', () => {
    it('should return full record', async () => {
      const result = await User.create(userData);
      expect(result).toMatchObject(userData);

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
      expect(result[0]).toMatchObject(userData);
      expect(result[1]).toMatchObject(userData);

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
