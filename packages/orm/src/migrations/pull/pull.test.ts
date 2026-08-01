import { pull } from './pull';
import {
  DefaultColumnTypes,
  DefaultSchemaConfig,
  Adapter,
  AdapterConfigBase,
  noop,
  getCallerFilePath,
  AdapterClass,
} from 'pqb/internal';
import { testConfig } from '../migrations.test-utils';
import {
  ChangeCallback,
  RakeDbConfig,
  createMigrationInterface,
} from 'rake-db';
import fs from 'node:fs/promises';
import { asMock, TestAdapter, testColumnTypes } from 'test-utils';
import path from 'node:path';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(),
  readdir: jest.fn(() => Promise.resolve([])),
}));

jest.mock('../generate/generate');

asMock(getCallerFilePath).mockReturnValue(
  path.join(__dirname, '..', 'migrations.test-utils'),
);

const options: AdapterConfigBase[] = [
  {
    databaseURL: `${process.env.PG_GENERATE_URL}-${process.env.JEST_WORKER_ID}`,
  },
];

let adapters: Adapter[] = [];
let closers: (() => Promise<void>)[] = [];
let config: RakeDbConfig = testConfig;

let prepareDbTransactionPromise: Promise<void> | undefined;
let resolvePrepareDbTransaction: ((err: Error) => void) | undefined;

const rollbackErr = new Error('Rollback');

const arrange = async ({
  config: arrangedConfig,
  prepareDb,
  dbFile = `import { orchidORM } from 'orchid-orm';

export const db = orchidORM({ databaseURL: 'url' }, {});
`,
}: {
  config?: RakeDbConfig;
  prepareDb?: ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>;
  dbFile?: string | false;
}) => {
  config = arrangedConfig ?? testConfig;

  adapters = options.map(
    (config) =>
      new AdapterClass({
        driverAdapter: TestAdapter,
        config,
      }),
  );
  closers = adapters.map((adapter) => () => adapter.close());

  const adapter = adapters[0];

  if (prepareDb) {
    await new Promise<void>((resolve) => {
      prepareDbTransactionPromise = adapter
        .transaction(
          undefined,
          undefined,
          (trx) =>
            new Promise<void>(async (_, rejectTransaction) => {
              AdapterClass.prototype.query = (...args) => trx.query(...args);
              AdapterClass.prototype.arrays = (...args) => trx.arrays(...args);

              // `generate` will attempt to close the adapter, but we need to keep it open in the test
              trx.close = noop as () => Promise<void>;

              adapters[0] = trx;

              const db = createMigrationInterface(trx, true, config).getDb(
                config.columnTypes,
              );

              await prepareDb(db, true);

              resolve();

              resolvePrepareDbTransaction = rejectTransaction;
            }),
        )
        .catch((err) => {
          if (err !== rollbackErr) {
            throw err;
          }
        });
    });
  }

  if (dbFile) {
    asMock(fs.readFile).mockResolvedValueOnce(dbFile);
  }
};

const act = () => pull(adapters, config);

const assert = {
  tableFile(calls: [path: string, content: string][]) {
    expect(
      asMock(fs.writeFile).mock.calls.filter(
        ([path]) => !path.endsWith('db.ts'),
      ),
    ).toEqual(
      calls.map(([tablePath, content]) => [
        path.resolve(testConfig.basePath, tablePath),
        content,
        { flag: 'wx' },
      ]),
    );
  },
  dbFile(calls: [path: string, content: string][]) {
    expect(
      asMock(fs.writeFile).mock.calls.filter(([path]) =>
        path.endsWith('db.ts'),
      ),
    ).toEqual(calls.map(([path, content]) => [path, content]));
  },
};

describe('pull', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config = testConfig;
  });

  afterEach(async () => {
    resolvePrepareDbTransaction?.(rollbackErr);
    await Promise.all([
      prepareDbTransactionPromise,
      ...closers.map((close) => close()),
    ]);
  });

  describe('create table', () => {
    it('should reject baseTable without defineTable', async () => {
      await arrange({
        config: {
          ...testConfig,
          defineTable: undefined,
          baseTable: class BaseTable {
            static exportAs = 'BaseTable';
            static getFilePath = () =>
              path.join(__dirname, '..', 'migrations.test-utils');

            types = testColumnTypes;
          },
        },
        dbFile: false,
      });

      await expect(act()).rejects.toThrow(
        '`defineTable` setting must be set in the migrations config for pull command',
      );
    });

    it('should create a table', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createSchema('schema');

          await db.createEnum('numbers', ['one', 'two']);

          await db.createDomain('domain', (t) => t.integer().nullable());

          await db.createTable(
            'schema.one',
            (t) => ({
              one: t.integer().index({ name: 'one_idx' }),
              two: t.text().unique({ name: 'two_idx' }),
              snake_case: t.boolean(),
              numbers: t.enum('numbers'),
              domain: t.domain('domain'),
            }),
            (t) => [
              t.unique(['one', 'two'], {
                name: 'uniqueIdx',
                nullsNotDistinct: true,
              }),
              t.primaryKey(['one', 'two'], 'onePkey'),
              t.check(t.sql`one = 69`),
              t.check(t.sql`one::text != two`, 'tableCheck'),
            ],
          );
        },
      });

      await act();

      assert.tableFile([
        [
          'tables/one.table.ts',
          `import { Selectable, Insertable, Updatable } from 'orchid-orm';
import { defineTable, sql } from '../migrations.test-utils';

export type One = Selectable<typeof OneTable>;
export type OneNew = Insertable<typeof OneTable>;
export type OneUpdate = Updatable<typeof OneTable>;

export const OneTable = defineTable(
  'one',
  {
    schema: 'schema',
  },
  (t) => ({
    one: t
      .integer()
      .index({
        name: 'one_idx',
      })
      .check(sql\`(one = 69)\`),
    two: t.text().unique({
      name: 'two_idx',
    }),
    snakeCase: t.name('snake_case').boolean(),
    numbers: t.enum('numbers', ['one', 'two']),
    domain: t.domain('public.domain').as(t.integer().nullable()),
  }),
)
  .primaryKey(['one', 'two'], 'onePkey')
  .unique(['one', 'two'], {
    name: 'uniqueIdx',
    nullsNotDistinct: true,
  })
  .check(sql\`((one)::text <> two)\`, 'tableCheck');
;
`,
        ],
      ]);
    });

    it('should set noPrimaryKey and comment to the table', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable(
            'one',
            { noPrimaryKey: true, comment: 'table comment' },
            (t) => ({
              column: t.text(),
            }),
          );
        },
      });

      await act();

      assert.tableFile([
        [
          'tables/one.table.ts',
          `import { Selectable, Insertable, Updatable } from 'orchid-orm';
import { defineTable } from '../migrations.test-utils';

export type One = Selectable<typeof OneTable>;
export type OneNew = Insertable<typeof OneTable>;
export type OneUpdate = Updatable<typeof OneTable>;

export const OneTable = defineTable(
  'one',
  {
    comment: 'table comment',
    noPrimaryKey: true,
  },
  (t) => ({
    column: t.text(),
  }),
);
`,
        ],
      ]);
    });

    it('should create a function-style table when defineTable is configured', async () => {
      const defineTable = {
        types: testColumnTypes,
        exportAs: 'myDefineTable',
        getFilePath: () => path.join(__dirname, '..', 'migrations.test-utils'),
      };

      await arrange({
        config: {
          ...testConfig,
          baseTable: undefined,
          defineTable,
        },
        async prepareDb(db) {
          await db.createTable(
            'one',
            { noPrimaryKey: true, comment: 'table comment' },
            (t) => ({
              column: t.text(),
            }),
          );
        },
      });

      await act();

      assert.tableFile([
        [
          'tables/one.table.ts',
          `import { Selectable, Insertable, Updatable } from 'orchid-orm';
import { myDefineTable } from '../migrations.test-utils';

export type One = Selectable<typeof OneTable>;
export type OneNew = Insertable<typeof OneTable>;
export type OneUpdate = Updatable<typeof OneTable>;

export const OneTable = myDefineTable(
  'one',
  {
    comment: 'table comment',
    noPrimaryKey: true,
  },
  (t) => ({
    column: t.text(),
  }),
);
`,
        ],
      ]);
    });

    it('should add relation if table has a foreign key to another table', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('one', (t) => ({
            one: t.integer().primaryKey(),
            two: t.text().primaryKey(),
          }));

          await db.createTable(
            'two',
            (t) => ({
              three: t.integer().primaryKey(),
              four: t.text().primaryKey(),
            }),
            (t) =>
              t.foreignKey(['three', 'four'], 'one', ['one', 'two'], {
                name: 'fkeyName',
              }),
          );
        },
      });

      await act();

      assert.tableFile([
        [
          'tables/one.table.ts',
          `import { Selectable, Insertable, Updatable } from 'orchid-orm';
import { defineTable } from '../migrations.test-utils';

export type One = Selectable<typeof OneTable>;
export type OneNew = Insertable<typeof OneTable>;
export type OneUpdate = Updatable<typeof OneTable>;

export const OneTable = defineTable(
  'one',
  (t) => ({
    one: t.integer(),
    two: t.text(),
  }),
)
  .primaryKey(['one', 'two'])
;
`,
        ],
        [
          'tables/two.table.ts',
          `import { Selectable, Insertable, Updatable } from 'orchid-orm';
import { defineTable } from '../migrations.test-utils';

export type Two = Selectable<typeof TwoTable>;
export type TwoNew = Insertable<typeof TwoTable>;
export type TwoUpdate = Updatable<typeof TwoTable>;

export const TwoTable = defineTable('two', (t) => ({
  three: t.integer(),
  four: t.text(),
}))
  .primaryKey(['three', 'four'])
  .foreignKey(
    ['three', 'four'],
    'one',
    ['one', 'two'],
    {
      name: 'fkeyName',
    },
  )
;
`,
        ],
      ]);
    });
  });

  describe('update db file', () => {
    it('should add tables to the db file', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('one', { noPrimaryKey: true });
          await db.createTable('two', { noPrimaryKey: true });
        },
      });

      await act();

      assert.dbFile([
        [
          path.resolve(testConfig.basePath, testConfig.dbPath as string),
          `import { orchidORM } from 'orchid-orm';
import { OneTable } from '../../tables/one.table';
import { TwoTable } from '../../tables/two.table';

export const db = orchidORM({ databaseURL: 'url' }, {
  one: OneTable,
  two: TwoTable,
});
`,
        ],
      ]);
    });

    it('should add tables to non empty tables list', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('one', { noPrimaryKey: true });
          await db.createTable('two', { noPrimaryKey: true });
        },
        dbFile: `import { orchidORM } from 'orchid-orm';
import { SomeTable } from '../../tables/some.table';

export const db = orchidORM({ databaseURL: 'url' }, {
  some: SomeTable
});
`,
      });

      await act();

      assert.dbFile([
        [
          path.resolve(testConfig.basePath, testConfig.dbPath as string),
          `import { orchidORM } from 'orchid-orm';
import { SomeTable } from '../../tables/some.table';
import { OneTable } from '../../tables/one.table';
import { TwoTable } from '../../tables/two.table';

export const db = orchidORM({ databaseURL: 'url' }, {
  some: SomeTable,
  one: OneTable,
  two: TwoTable,
});
`,
        ],
      ]);
    });

    it('should add tables to non empty tables list with ending comma', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('one', { noPrimaryKey: true });
        },
        dbFile: `import { orchidORM } from 'orchid-orm';
import { SomeTable } from '../../tables/some.table';

export const db = orchidORM({ databaseURL: 'url' }, {
  some: SomeTable,
});
`,
      });

      await act();

      assert.dbFile([
        [
          path.resolve(testConfig.basePath, testConfig.dbPath as string),
          `import { orchidORM } from 'orchid-orm';
import { SomeTable } from '../../tables/some.table';
import { OneTable } from '../../tables/one.table';

export const db = orchidORM({ databaseURL: 'url' }, {
  some: SomeTable,
  one: OneTable,
});
`,
        ],
      ]);
    });

    it('should handle import as', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createTable('one', { noPrimaryKey: true });
        },
        dbFile: `import { orchidORM as custom } from 'orchid-orm';
import { SomeTable } from '../../tables/some.table';

export const db = custom({ databaseURL: 'url' }, {
  some: SomeTable
});
`,
      });

      await act();

      assert.dbFile([
        [
          path.resolve(testConfig.basePath, testConfig.dbPath as string),
          `import { orchidORM as custom } from 'orchid-orm';
import { SomeTable } from '../../tables/some.table';
import { OneTable } from '../../tables/one.table';

export const db = custom({ databaseURL: 'url' }, {
  some: SomeTable,
  one: OneTable,
});
`,
        ],
      ]);
    });

    describe('db options', () => {
      it('should add db extension', async () => {
        await arrange({
          async prepareDb(db) {
            await db.createExtension('public.cube', { version: '1.5' });
          },
        });

        adapters = options.map(
          (opts) =>
            new AdapterClass({
              driverAdapter: TestAdapter,
              config: {
                ...opts,
                schema: 'schema',
              },
            }) as unknown as Adapter,
        );

        await pull(adapters, testConfig);

        assert.dbFile([
          [
            path.resolve(testConfig.basePath, testConfig.dbPath as string),
            `import { orchidORM } from 'orchid-orm';

export const db = orchidORM({
  databaseURL: 'url',
  extensions: [{ 'public.cube': '1.5' }],
}, {});
`,
          ],
        ]);
      });

      it('should add db extension', async () => {
        await arrange({
          async prepareDb(db) {
            await db.createDomain('one', (t) => t.integer().nullable());
            await db.createDomain('two', (t) =>
              t.integer().check(t.sql`VALUE = 123`),
            );

            await db.createTable('table', { noPrimaryKey: true }, (t) => ({
              one: t.domain('one'),
            }));
          },
        });

        await act();

        assert.dbFile([
          [
            path.resolve(testConfig.basePath, testConfig.dbPath as string),
            `import { orchidORM } from 'orchid-orm';
import { TableTable } from '../../tables/table.table';

export const db = orchidORM({
  databaseURL: 'url',
  domains: {
    one: (t) => t.integer().nullable(),
    two: (t) => t.integer().check(t.sql\`(VALUE = 123)\`),
  },
}, {
  table: TableTable,
});
`,
          ],
        ]);
      });
    });
  });
});
