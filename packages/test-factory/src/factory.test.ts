import { ormFactory, tableFactory } from './factory';
import { db, User, BaseTable, Profile } from './test-utils';
import { z } from 'zod';
import { orchidORM } from 'orchid-orm';
import { ColumnsShape, makeColumnTypes, DefaultColumnTypes } from 'pqb';
import { assertType, testAdapter, useTestDatabase } from 'test-utils';
import { zodSchemaConfig, ZodSchemaConfig } from 'schema-to-zod';

describe('factory', () => {
  useTestDatabase();

  describe('sequence and sequenceDistance', () => {
    beforeAll(() => {
      process.env.JEST_WORKER_ID = '5';
    });

    afterAll(() => {
      process.env.JEST_WORKER_ID = '1';
    });

    it('should depend on process.env.JEST_WORKER_ID when it is defined', () => {
      const factory = tableFactory(db.user);
      expect(factory.sequence).toBe(4001);
    });

    it('should allow to override sequence', () => {
      const factory = tableFactory(db.user, {
        sequence: 123,
      });
      expect(factory.sequence).toBe(123);
    });

    it('should allow to override sequence distance', () => {
      const factory = tableFactory(db.user, {
        sequenceDistance: 100,
      });
      expect(factory.sequence).toBe(401);
    });
  });

  const factory = ormFactory(db);

  describe('build', () => {
    it('should build an object for the table', () => {
      const data = factory.user.build();

      assertType<typeof data, User>();

      expect(() => factory.user.schema.parse(data)).not.toThrow();
    });

    it('should accept data with values to override result', () => {
      const data = factory.user.build({
        age: 18,
        name: 'name',
        extra: true,
      });

      assertType<
        typeof data,
        User & { name: 'name'; age: 18; extra: boolean }
      >();

      expect(data).toMatchObject({ age: 18, name: 'name', extra: true });
    });

    it('should accept data with functions to override result', () => {
      const data = factory.user.build({
        age: () => 18,
        name: () => 'name',
        extra: () => true,
      });

      assertType<typeof data, User & { age: number; extra: true }>();

      expect(data).toMatchObject({ age: 18, name: 'name', extra: true });
    });

    it('should limit long strings with 1000 by default', () => {
      const data = factory.profile.build();

      expect(data.bio.length).toBeLessThanOrEqual(1000);
    });

    it('should respect max which is set on column', () => {
      class ProfileTable extends BaseTable {
        readonly table = 'profile';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          bio: t.text().min(100).max(120),
        }));
      }

      const db = orchidORM(
        {
          adapter: testAdapter,
        },
        {
          profile: ProfileTable,
        },
      );

      const profileFactory = tableFactory(db.profile);
      const data = profileFactory.build();

      expect(data.bio.length).toBeLessThanOrEqual(120);
    });

    it('should allow to override maxTextLength', () => {
      const profileFactory = tableFactory(db.profile, {
        maxTextLength: 500,
      });
      const data = profileFactory.build();

      expect(data.bio.length).toBeLessThanOrEqual(500);
    });

    it('should support domain and custom type columns', () => {
      class UserTable extends BaseTable {
        readonly table = 'user';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          name: t.domain('domainName').as(t.integer()),
          password: t.type('customType').as(t.integer()),
        }));
      }

      const db = orchidORM(testAdapter, {
        user: UserTable,
      });

      const factory = tableFactory(db.user);

      const data = factory.build();

      expect(data).toEqual({
        id: expect.any(Number),
        name: expect.any(Number),
        password: expect.any(Number),
      });
    });
  });

  describe('buildList', () => {
    it('should build a list of objects', () => {
      const arr = factory.user.buildList(2);

      assertType<typeof arr, User[]>();

      expect(() =>
        arr.forEach((item) => factory.user.schema.parse(item)),
      ).not.toThrow();
    });

    it('should allow overriding data', () => {
      const arr = factory.user.buildList(2, {
        age: 18,
        name: 'name',
        extra: true,
      });

      assertType<
        typeof arr,
        Array<User & { name: 'name'; age: 18; extra: boolean }>
      >();

      expect(arr).toMatchObject([
        { age: 18, name: 'name', extra: true },
        { age: 18, name: 'name', extra: true },
      ]);
    });

    it('should accept data with functions to override result', () => {
      const arr = factory.user.buildList(2, {
        age: () => 18,
        name: () => 'name',
        extra: () => true,
      });

      assertType<typeof arr, Array<User & { age: number; extra: true }>>();

      expect(arr).toMatchObject([
        { age: 18, name: 'name', extra: true },
        { age: 18, name: 'name', extra: true },
      ]);
    });
  });

  describe('buildMany', () => {
    it('should build multiple objects', () => {
      const arr = factory.user.buildMany({}, {});

      assertType<typeof arr, [User, User]>();

      expect(() =>
        arr.forEach((item) => factory.user.schema.parse(item)),
      ).not.toThrow();
    });

    it('should allow overriding data', () => {
      const input = [
        {
          age: 18,
          name: 'one',
          extra: false,
        },
        {
          age: 25,
          name: 'two',
          extra: true,
        },
      ] as const;

      const arr = factory.user.buildMany(...input);

      assertType<
        typeof arr,
        [User & (typeof input)[0], User & (typeof input)[1]]
      >();

      expect(arr).toMatchObject(input);
    });

    it('should accept data with functions to override result', () => {
      const arr = factory.user.buildMany(
        {
          age: () => 18,
          name: () => 'one',
          extra: () => false,
        },
        {
          age: () => 25,
          name: () => 'two',
          extra: () => true,
        },
      );

      assertType<
        typeof arr,
        [
          User & { age: number; name: string; extra: false },
          User & { age: number; name: string; extra: true },
        ]
      >();

      expect(arr).toMatchObject([
        { age: 18, name: 'one', extra: false },
        { age: 25, name: 'two', extra: true },
      ]);
    });
  });

  describe('omit', () => {
    it('should allow to build data with omitted fields', () => {
      const data = factory.user.omit({ id: true, name: true }).build();

      assertType<typeof data, Omit<User, 'id' | 'name'>>();

      expect(() =>
        factory.user.schema.strict().omit({ id: true, name: true }).parse(data),
      ).not.toThrow();
    });
  });

  describe('pick', () => {
    it('should allow to build data with picked fields', () => {
      const data = factory.user.pick({ id: true, name: true }).build();

      assertType<typeof data, Pick<User, 'id' | 'name'>>();

      expect(() =>
        factory.user.schema.strict().pick({ id: true, name: true }).parse(data),
      ).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create record with generated data, except identity primary keys, datetime numbers should be the same in the record and to be around now', async () => {
      const item = await factory.user.create();

      expect(item.createdAt).toBe(item.updatedAt);

      assertType<typeof item, User>();

      expect(() => factory.user.schema.parse(item)).not.toThrow();
    });

    it('should create record with overridden data', async () => {
      const item = await factory.user.create({ name: 'name' });

      assertType<typeof item, User>();

      expect(item.name).toBe('name');
    });

    it('should create record with nested create', async () => {
      const user = await factory.user.create({
        profile: {
          create: {
            bio: 'bio',
          },
        },
      });

      assertType<typeof user, User>();
    });
  });

  describe('createList', () => {
    it('should create a list of records, datetime numbers should be the same in one record and increase for each next record', async () => {
      const items = await factory.user.createList(2);

      assertType<typeof items, User[]>();

      expect(items[0].name).not.toBe(items[1].name);

      expect(items[0].createdAt).toEqual(items[0].updatedAt);
      expect(items[1].createdAt).toEqual(items[1].updatedAt);

      expect(items[0].createdAt).toBeLessThan(items[1].createdAt);

      expect(() => z.array(factory.user.schema).parse(items)).not.toThrow();
    });

    it('should create a list of records with overridden data', async () => {
      const items = await factory.user.createList(2, { name: 'name' });

      assertType<typeof items, User[]>();

      expect(items.map((item) => item.name)).toEqual(['name', 'name']);
    });

    it('should create a related belongsTo record using a function, individually for every record in a list', async () => {
      const items = await factory.profile.createList(2, {
        userId: async () => (await factory.user.create()).id,
      });

      assertType<typeof items, Profile[]>();

      expect(items[0].userId).not.toBe(items[1].userId);
    });
  });

  describe('createMany', () => {
    it('should create many records with generated data', async () => {
      const arr = await factory.user.createMany({}, {});

      assertType<typeof arr, [User, User]>();

      expect(() =>
        arr.forEach((item) => factory.user.schema.parse(item)),
      ).not.toThrow();
    });

    it('should create many records with overridden data', async () => {
      const arr = await factory.user.createMany(
        {
          name: 'one',
        },
        {
          name: 'two',
        },
      );

      assertType<typeof arr, [User, User]>();

      expect(arr.map((it) => it.name)).toEqual(['one', 'two']);
    });

    it('should override data with functions', async () => {
      const arr = await factory.user.createMany(
        {
          name: () => 'one',
        },
        {
          name: () => 'two',
        },
      );

      assertType<typeof arr, [User, User]>();

      expect(arr.map((it) => it.name)).toEqual(['one', 'two']);
    });
  });

  describe('set', () => {
    it('should set data to override result and work with build', () => {
      const data = factory.user
        .set({
          age: 18,
        })
        .build({
          name: 'name',
        });

      assertType<typeof data, User & { age: number; name: 'name' }>();

      expect(data).toMatchObject({ age: 18, name: 'name' });
    });

    it('should set data to override result and work with buildList', () => {
      const arr = factory.user
        .set({
          age: 18,
        })
        .buildList(2, {
          name: 'name',
        });

      assertType<typeof arr, (User & { age: number; name: 'name' })[]>();
    });

    it('should set data to override result and work with create', async () => {
      const item = await factory.user.set({ age: 18 }).create();

      assertType<typeof item, User>();

      expect(() => factory.user.schema.parse(item)).not.toThrow();
      expect(item.age).toBe(18);
    });

    it('should set data to override result and work with createList', async () => {
      const items = await factory.user.set({ age: 18 }).createList(2);

      assertType<typeof items, User[]>();

      expect(() => z.array(factory.user.schema).parse(items)).not.toThrow();
      expect(items.map((item) => item.age)).toEqual([18, 18]);
    });
  });

  describe('custom methods', () => {
    class ExtendedFactory extends tableFactory(db.user).extend() {
      specificUser(age: number) {
        return this.otherMethod().set({
          age,
          name: 'specific',
        });
      }
      otherMethod() {
        return this.set({ extra: true });
      }
    }

    const extendedFactory = new ExtendedFactory();

    it('should respect omitted fields and build a proper object', async () => {
      const data = extendedFactory.omit({ id: true }).specificUser(42).build();

      assertType<
        typeof data,
        Omit<User, 'id'> & { age: number; extra: boolean }
      >();

      expect(data).toMatchObject({ age: 42, name: 'specific', extra: true });
    });

    it('should respect picked fields and build a proper object', async () => {
      const data = extendedFactory
        .pick({ age: true, name: true })
        .specificUser(42)
        .build();

      assertType<typeof data, Pick<User, 'name'> & { age: number }>();

      expect(data).toEqual({ age: 42, name: 'specific' });
    });
  });

  describe('unique columns', () => {
    const columnTypes = makeColumnTypes(zodSchemaConfig);

    const makeTable = <T extends ColumnsShape>(
      fn: (t: DefaultColumnTypes<ZodSchemaConfig>) => T,
    ) => {
      return class extends BaseTable {
        readonly table = 'table';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
          ...fn(columnTypes),
        }));
      };
    };

    const min = 29;
    const max = 1;
    const gt = 10;
    const gte = 10;

    const db = orchidORM(
      {
        adapter: testAdapter,
        log: false,
      },
      {
        text: makeTable((t) => ({ name: t.text(3, 100).unique() })),
        email: makeTable((t) => ({ name: t.text(3, 100).email().unique() })),
        url: makeTable((t) => ({ name: t.text(3, 100).url().unique() })),
        max: makeTable((t) => ({
          name: t.text(3, 100).min(min).max(max).unique(),
        })),
        length: makeTable((t) => ({
          name: t.text(3, 100).length(max).unique(),
        })),
        number: makeTable((t) => ({ age: t.integer().unique() })),
        gt: makeTable((t) => ({ age: t.integer().gt(gt).unique() })),
        gte: makeTable((t) => ({ age: t.integer().gte(gte).unique() })),
      },
    );

    const textFactory = tableFactory(db.text);
    const emailFactory = tableFactory(db.email);
    const urlFactory = tableFactory(db.url);
    const maxFactory = tableFactory(db.max);
    const lengthFactory = tableFactory(db.length);
    const numberFactory = tableFactory(db.number);
    const gtFactory = tableFactory(db.gt);
    const gteFactory = tableFactory(db.gte);

    it('should prefix unique text column with sequence and space', () => {
      textFactory.sequence = 42;

      const first = textFactory.build();
      const second = textFactory.build();
      const third = textFactory.build();

      expect(first.name.startsWith('42 ')).toBe(true);
      expect(second.name.startsWith('43 ')).toBe(true);
      expect(third.name.startsWith('44 ')).toBe(true);
    });

    it('should prefix unique email with sequence and dash', () => {
      emailFactory.sequence = 42;

      const first = emailFactory.build();
      const second = emailFactory.build();
      const third = emailFactory.build();

      expect(first.name.startsWith('42-')).toBe(true);
      expect(second.name.startsWith('43-')).toBe(true);
      expect(third.name.startsWith('44-')).toBe(true);
    });

    it('should prefix unique url with sequence and dash', () => {
      urlFactory.sequence = 42;

      const first = urlFactory.build();
      const second = urlFactory.build();
      const third = urlFactory.build();

      expect(first.name.match(/^https?:\/\/42-/)).not.toBe(null);
      expect(second.name.match(/^https?:\/\/43-/)).not.toBe(null);
      expect(third.name.match(/^https?:\/\/44-/)).not.toBe(null);
    });

    it('should set value no longer than max', () => {
      maxFactory.sequence = 42;

      const value = maxFactory.build();

      expect(value.name.length).toBeLessThanOrEqual(max);
    });

    it('should set value with correct length when length option is set', () => {
      lengthFactory.sequence = 42;

      const value = lengthFactory.build();

      expect(value.name.length).toBe(max);
    });

    it('should use sequence for a number for unique numeric column', () => {
      numberFactory.sequence = 42;

      const first = numberFactory.build();
      const second = numberFactory.build();
      const third = numberFactory.build();

      expect(first.age).toBe(42);
      expect(second.age).toBe(43);
      expect(third.age).toBe(44);
    });

    it('should support gt option for unique numeric column', () => {
      gtFactory.sequence = 1;

      const first = gtFactory.build();
      const second = gtFactory.build();
      const third = gtFactory.build();

      expect(first.age).toBe(11);
      expect(second.age).toBe(12);
      expect(third.age).toBe(13);
    });

    it('should support gt option for unique numeric column', () => {
      gteFactory.sequence = 1;

      const first = gteFactory.build();
      const second = gteFactory.build();
      const third = gteFactory.build();

      expect(first.age).toBe(10);
      expect(second.age).toBe(11);
      expect(third.age).toBe(12);
    });

    it('should leave explicitly set values as is', () => {
      const data = textFactory.build({ name: 'name' });
      expect(data.name).toBe('name');
    });

    it('should work in buildList', () => {
      textFactory.sequence = 42;

      const [first, second, third] = textFactory.buildList(3);

      expect(first.name.startsWith('42 ')).toBe(true);
      expect(second.name.startsWith('43 ')).toBe(true);
      expect(third.name.startsWith('44 ')).toBe(true);
    });
  });
});
