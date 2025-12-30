import { FactoryConfig, ormFactory, tableFactory } from './factory';
import { db, User, BaseTable, Profile } from './test-utils';
import { z, ZodObject, ZodRawShape } from 'zod/v4';
import { Column, orchidORMWithAdapter } from 'orchid-orm';
import { ColumnsShape, makeColumnTypes, DefaultColumnTypes } from 'pqb';
import {
  assertType,
  testAdapter,
  testDbOptions,
  useTestDatabase,
} from 'test-utils';
import { zodSchemaConfig, ZodSchemaConfig } from 'orchid-orm-schema-to-zod';
import { faker } from '@faker-js/faker';

const t = makeColumnTypes(zodSchemaConfig);

describe('factory', () => {
  useTestDatabase();

  describe('mocked date', () => {
    const { Date } = global;
    const fixedDate = new Date('2024-01-01T12:00:00Z');

    beforeAll(() => {
      global.Date = class extends Date {
        constructor() {
          super(fixedDate);
        }
      } as never;
    });

    afterAll(() => {
      global.Date = Date;
    });

    it('should support all column types', () => {
      const columns: ColumnsShape = {};
      for (const key in t) {
        if (
          key === 'schema' ||
          key === 'timestamps' ||
          key === 'timestampsNoTZ' ||
          key === 'name' ||
          key === 'sql' ||
          key === 'type'
        )
          continue;

        if (key === 'enum') {
          columns[key] = t.enum('enum', ['foo', 'bar']);
        } else if (key === 'array') {
          columns[key] = t.array(t.integer());
        } else if (key === 'domain') {
          columns[key] = t.domain('type').as(t.integer());
        } else if (key === 'bit') {
          columns[key] = t.bit(5);
        } else if (key === 'geography') {
          for (const key in t.geography) {
            columns.geographyPoint =
              t.geography[key as keyof typeof t.geography]();
          }
        } else if (key === 'json') {
          columns[key] = t.json(z.object({ a: z.string(), b: z.number() }));
        } else if (typeof t[key as 'integer'] === 'function') {
          columns[key] = t[key as 'integer']();
        } else {
          throw new Error(`Unrecognized column type ${key}`);
        }
      }

      columns.email = t.string().email();
      columns.uid = t.uuid();
      columns.url = t.string();
      columns.name = t.string();
      columns.phoneNumber = t.string();
      columns.image = t.string();
      columns.imageUrl = t.string();

      class Table extends BaseTable {
        readonly table = 'table';
        noPrimaryKey = true;
        columns = this.setColumns(() => columns);
      }

      const db = orchidORMWithAdapter(
        { adapter: testAdapter },
        {
          table: Table,
        },
      );

      const config: FactoryConfig = {
        fakeDataForTypes: {
          jsonb(c) {
            const result =
              'json keys: ' +
              Object.keys(
                ((c as Column).inputSchema as ZodObject<ZodRawShape>).shape,
              ).join(', ');
            return () => result;
          },
        },
      };

      const factory = tableFactory(db.table, config);
      faker.seed(1);

      const data = factory.build();

      data.bigint = String(data.bigint);
      data.bigSerial = String(data.bigSerial);
      data.bytea = (data.bytea as Buffer).toString('hex');

      expect(data).toEqual({
        enum: 'foo',
        array: [-2146992412, -848975136, -1517171897, -1750892404],
        smallint: -20562,
        integer: -663311627,
        bigint: '7792690340625041376',
        numeric: 0.1698304195645689,
        decimal: 0.8781425034294131,
        real: 0.0983468338330501,
        doublePrecision: 0.42110762500505217,
        identity: 1966620558,
        image: 'https://picsum.photos/seed/Zaz2M/1428/433',
        imageUrl: 'https://picsum.photos/seed/ydLIa/759/2112',
        smallSerial: 2173,
        serial: 824105929,
        bigSerial: '9137856604357778800',
        money: '$53.36',
        varchar: 'Caesar Salad',
        text: 'Ambulo cupio suasoria cupio admiratio facilis sonitus dolorum. Occaecati venio apto apud timor cubicularis asperiores vestigium conqueror tantillus. Vacuus quia tantillus conscendo centum vehemens cursus vobis.',
        string: 'Pho',
        citext: "Israel's Special Grape Seed Oil",
        bytea: 'e79200',
        date: '2024-01-01',
        timestampNoTZ: '2024-01-01 12:00:00.000Z',
        timestamp: '2024-01-01 12:00:00.000Z+04:03',
        time: '12:00:00',
        interval: '3 years 6 mons 27 days 8 hours 54 mins 36.8 secs',
        boolean: true,
        point: '(85.89, 38.18)',
        line: '{99.47,-65.54,-72.58}',
        lseg: '((86.52, 39.37), (-86.8, 51.1))',
        box: '((50.78, 84.61), (42.31, -75.15))',
        path: '((-94.76, -94.34), (-50.76, 72.01))',
        polygon:
          '((68.41, -75.17), (-44.17, 17.15), (93.92, 12.21), (-96.28, 60.13), (-53.41, 61.42), (-22.43, 72.71))',
        circle: '<(49.43, 11.25), 13.64>',
        cidr: '31.11.27.57/23',
        inet: '01fc:45a4:cfc5:adc3:01ad:c6fc:8cae:518d',
        macaddr: '3c:14:c3:a8:e4:1b',
        macaddr8: '0xAD:0xE0:0x5d:0xEE:0xcE:0xe8:0xad:0xcE',
        bit: '01011',
        bitVarying: '01001111010000',
        tsvector:
          'degero in theologus circumvenio depraedor patruus accendo optio damno timor',
        tsquery: 'vapulus & nesciunt | tertius | adnuo',
        uuid: 'ae0f6f9d-9a49-4cdc-9bd5-a7666596fa36',
        xml:
          '<items>\n' +
          '  <item>\n' +
          '    <id>eea44d8c-9b8c-4975-b161-f2cdb9275394</id>\n' +
          '    <name>Tabitha</name>\n' +
          '    <email>Bernita_Kutch20@gmail.com</email>\n' +
          '    <address>462 Jorge Lights</address>\n' +
          '    <created_at>2024-01-01T12:00:00.000Z</created_at>\n' +
          '  </item>\n' +
          '  <item>\n' +
          '    <id>298a2c38-c05d-4d8d-bfdd-1ab9c0cb44a5</id>\n' +
          '    <name>Isabella</name>\n' +
          '    <email>Yolanda54@hotmail.com</email>\n' +
          '    <address>9551 Balistreri Crossing</address>\n' +
          '    <created_at>2024-01-01T12:00:00.000Z</created_at>\n' +
          '  </item>\n' +
          '  <item>\n' +
          '    <id>b05dbb37-9f33-44c7-a083-c409d6b88fc0</id>\n' +
          '    <name>Jamel</name>\n' +
          '    <email>Dallin.Bode@hotmail.com</email>\n' +
          '    <address>773 Madison Street</address>\n' +
          '    <created_at>2024-01-01T12:00:00.000Z</created_at>\n' +
          '  </item>\n' +
          '  <item>\n' +
          '    <id>da210171-0c6b-4777-87c6-e0c29080fece</id>\n' +
          '    <name>Carlotta</name>\n' +
          '    <email>Lilyan73@gmail.com</email>\n' +
          '    <address>3118 Diego Square</address>\n' +
          '    <created_at>2024-01-01T12:00:00.000Z</created_at>\n' +
          '  </item>\n' +
          '</items>',
        json: 'json keys: a, b',
        jsonText:
          '[{"id":"f485e568-f0be-4085-bd8b-7a40948e635e","name":"Rosalinda","email":"Dannie.Farrell@hotmail.com","address":{"street":"8172 Heller Cape","city":"Lake Jess","state":"Montana","zip":"59859"},"createdAt":"2024-01-01T12:00:00.000Z"},{"id":"e901176f-2fcd-4aa7-9057-b7720c5f358c","name":"Brady","email":"Joanny.Russel@gmail.com","address":{"street":"166 Volkman Pines","city":"South Ryleehaven","state":"North Carolina","zip":"52563-8172"},"createdAt":"2024-01-01T12:00:00.000Z"}]',
        domain: 1175958985,
        geographyPoint: '0101000020e610000088855ad3bc033ac09a081b9e5eb14b40',
        email: 'Cristal_Hackett74@yahoo.com',
        uid: '332601ac-133e-4b84-bd6e-b72f23662b3a',
        url: 'https://peppery-republican.name/',
        name: 'Theodore West',
        phoneNumber: '281-530-9354 x12052',
      });
    });
  });

  it('should support date min and max', () => {
    const date2000 = new Date(2000, 0, 1);
    const date2005 = new Date(2005, 0, 1);

    class Table extends BaseTable {
      readonly table = 'table';
      noPrimaryKey = true;
      columns = this.setColumns(() => ({
        dateBetween: t.date().min(date2000).max(date2005),
      }));
    }

    const db = orchidORMWithAdapter(
      { adapter: testAdapter },
      {
        table: Table,
      },
    );

    const factory = tableFactory(db.table);
    faker.seed(1);

    expect(factory.build().dateBetween).toBe('2002-01-31');
  });

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

      const db = orchidORMWithAdapter(
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
        maxTextLength: 5,
      });
      const data = profileFactory.build();

      expect(data.bio.length).toBeLessThanOrEqual(5);
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

      const db = orchidORMWithAdapter(
        { ...testDbOptions, adapter: testAdapter },
        {
          user: UserTable,
        },
      );

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
      faker.seed(1);
      const arr = factory.user.buildList(2);

      assertType<typeof arr, User[]>();

      expect(arr).toMatchObject([
        {
          name: 'Antoinette Gutmann',
        },
        {
          name: 'Byron VonRueden',
        },
      ]);
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
      faker.seed(1);
      const arr = factory.user.buildMany({}, {});

      assertType<typeof arr, [User, User]>();

      expect(arr).toMatchObject([
        {
          name: 'Antoinette Gutmann',
        },
        {
          name: 'Byron VonRueden',
        },
      ]);
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

      expect(Object.keys(data)).toEqual([
        'password',
        'picture',
        'data',
        'age',
        'active',
        'createdAt',
        'updatedAt',
      ]);
    });
  });

  describe('pick', () => {
    it('should allow to build data with picked fields', () => {
      const data = factory.user.pick({ id: true, name: true }).build();

      assertType<typeof data, Pick<User, 'id' | 'name'>>();

      expect(Object.keys(data)).toEqual(['id', 'name']);
    });
  });

  describe('create', () => {
    it('should create record with generated data, except identity primary keys, datetime numbers should be the same in the record and to be around now', async () => {
      const item = await factory.user.create();

      expect(item.createdAt).toBe(item.updatedAt);
      expect(item.id).toBeGreaterThanOrEqual(1);

      assertType<typeof item, User>();
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

    it('should let database to generate identity column value rather than faking it', async () => {
      const factory = tableFactory(db.user, {
        extend: {
          id: () => 0,
        },
      });

      const user = await factory.create();
      expect(user.id).not.toBe(0);
    });
  });

  describe('createList', () => {
    it('should create a list of records, datetime numbers should be the same in one record and increase for each next record', async () => {
      const items = await factory.user.createList(2);
      const [one, two] = items;

      assertType<typeof items, User[]>();

      expect(one.name).not.toBe(two.name);

      expect(one.createdAt).toEqual(one.updatedAt);
      expect(two.createdAt).toEqual(two.updatedAt);

      expect(one.id).toBeLessThan(two.id);
      expect(one.createdAt).toBeLessThan(two.createdAt);
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
      const [one, two] = arr;

      assertType<typeof arr, [User, User]>();

      expect(one.createdAt).toBe(one.updatedAt);
      expect(two.createdAt).toBe(two.updatedAt);

      expect(one.createdAt).toBeLessThan(two.createdAt);
      expect(one.id).toBeLessThan(two.id);
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

      expect(item.age).toBe(18);
    });

    it('should set data to override result and work with createList', async () => {
      const items = await factory.user.set({ age: 18 }).createList(2);

      assertType<typeof items, User[]>();

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

    const max = 1;
    const gt = 10;
    const gte = 10;

    const db = orchidORMWithAdapter(
      {
        adapter: testAdapter,
        log: false,
      },
      {
        text: makeTable((t) => ({ name: t.text().min(3).max(100).unique() })),
        email: makeTable((t) => ({
          name: t.text().min(3).max(100).email().unique(),
        })),
        url: makeTable((t) => ({
          name: t.text().min(3).max(100).url().unique(),
        })),
        max: makeTable((t) => ({
          name: t.text().max(max).unique(),
        })),
        length: makeTable((t) => ({
          name: t.text().min(3).max(100).length(max).unique(),
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

  describe('override table mocks', () => {
    const data = { name: 'name', tags: ['one', 'two'] };

    it('should use the given generator in tableFactory', () => {
      const factory = tableFactory(db.user, {
        extend: {
          data: () => data,
        },
      });

      expect(factory.build().data).toBe(data);
    });

    it('should use the given generator in ormFactory', () => {
      const factory = ormFactory(db, {
        extend: {
          user: {
            data: () => data,
          },
        },
      });

      expect(factory.user.build().data).toBe(data);
    });
  });
});
