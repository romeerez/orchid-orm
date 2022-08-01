import {
  AssertEqual,
  expectMatchObjectWithTimestamps,
  expectQueryNotMutated,
  line,
  User,
  useTestDatabase,
} from '../test-utils';
import { quote } from '../quote';

describe('insert', () => {
  useTestDatabase();

  it('should insert one record, returning void', async () => {
    const q = User.all();

    const now = new Date();

    const data = {
      name: 'name',
      password: 'password',
      createdAt: now,
      updatedAt: now,
    };

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

    const now = new Date();

    const data = {
      name: 'name',
      password: 'password',
      createdAt: now,
      updatedAt: now,
    };

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

    const now = new Date();

    const data = [
      {
        name: 'name',
        password: 'password',
        picture: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'name',
        password: 'password',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const query = q.insert(data);

    expect(query.toSql()).toBe(
      line(`
        INSERT INTO "user"("name", "password", "picture", "createdAt", "updatedAt")
        VALUES
          ('name', 'password', NULL, ${quote(now)}, ${quote(now)}),
          ('name', 'password', DEFAULT, ${quote(now)}, ${quote(now)})
      `),
    );

    const result = await query;
    const isVoid: AssertEqual<typeof result, void> = true;
    expect(isVoid).toBe(true);

    const inserted = await User.all();
    inserted.forEach((item, i) => {
      expectMatchObjectWithTimestamps(item, data[i]);
    });

    expectQueryNotMutated(q);
  });

  it('should insert many records, returning columns', async () => {
    const q = User.all();

    const now = new Date();

    const data = [
      {
        name: 'name',
        password: 'password',
        picture: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'name',
        password: 'password',
        createdAt: now,
        updatedAt: now,
      },
    ];

    const query = q.insert(data, ['id', 'name', 'createdAt', 'updatedAt']);

    expect(query.toSql()).toBe(
      line(`
        INSERT INTO "user"("name", "password", "picture", "createdAt", "updatedAt")
        VALUES
          ('name', 'password', NULL, ${quote(now)}, ${quote(now)}),
          ('name', 'password', DEFAULT, ${quote(now)}, ${quote(now)})
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
      expectMatchObjectWithTimestamps(item, data[i]);
    });

    expectQueryNotMutated(q);
  });
});
