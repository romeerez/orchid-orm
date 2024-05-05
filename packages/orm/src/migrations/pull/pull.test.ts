import { pull } from './pull';
import {
  Adapter,
  AdapterOptions,
  DefaultColumnTypes,
  DefaultSchemaConfig,
} from 'pqb';
import { testConfig } from '../migrations.test-utils';
import { ChangeCallback, createMigrationInterface } from 'rake-db';
import { ColumnSchemaConfig, noop } from 'orchid-core';
import fs from 'fs/promises';
import { asMock } from 'test-utils';
import path from 'node:path';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(),
}));
jest.mock('../generate/generate');

const options: AdapterOptions[] = [
  { databaseURL: process.env.PG_GENERATE_URL },
];

let prepareDbTransactionPromise: Promise<void> | undefined;
let resolvePrepareDbTransaction: (() => void) | undefined;
let arrangedAdapters: Adapter[] | undefined;

const arrange = async ({
  prepareDb,
  dbFile = `import { orchidORM } from 'orchid-orm';

export const db = orchidORM({ databaseURL: 'url' }, {});
`,
}: {
  prepareDb?: ChangeCallback<DefaultColumnTypes<DefaultSchemaConfig>>;
  dbFile?: string;
}) => {
  const adapters = options.map((opts) => new Adapter(opts));
  arrangedAdapters = [...adapters];

  const adapter = adapters[0];

  if (prepareDb) {
    await new Promise<void>((resolve) => {
      prepareDbTransactionPromise = adapter.transaction(
        { text: 'BEGIN' },
        (trx) =>
          new Promise<void>(async (resolveTransaction) => {
            Adapter.prototype.query = (...args) => trx.query(...args);
            Adapter.prototype.arrays = (...args) => trx.arrays(...args);

            // `generate` will attempt to close the adapter, but we need to keep it open in the test
            trx.close = noop as () => Promise<void>;

            adapters[0] = trx;

            const db = createMigrationInterface<
              ColumnSchemaConfig,
              DefaultColumnTypes<DefaultSchemaConfig>
            >(trx, true, testConfig);

            await prepareDb(db, true);

            resolve();

            resolvePrepareDbTransaction = resolveTransaction;
          }),
        { text: 'ROLLBACK' },
      );
    });
  }

  if (dbFile) {
    asMock(fs.readFile).mockResolvedValueOnce(dbFile);
  }
};

const act = () => pull(options, testConfig);

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
  beforeEach(jest.clearAllMocks);

  afterEach(async () => {
    resolvePrepareDbTransaction?.();
    await Promise.all([
      prepareDbTransactionPromise,
      ...(arrangedAdapters?.map((x) => x.close()) ?? []),
    ]);
  });

  describe('create table', () => {
    it('should create a table', async () => {
      await arrange({
        async prepareDb(db) {
          await db.createSchema('schema');

          await db.createEnum('numbers', ['one', 'two']);

          await db.createDomain('domain', (t) => t.integer().nullable());

          await db.createTable('schema.one', (t) => ({
            one: t.integer(),
            two: t.text(),
            snake_case: t.boolean(),
            numbers: t.enum('numbers'),
            domain: t.domain('domain'),
            ...t.unique(['one', 'two'], {
              name: 'uniqueIdx',
              nullsNotDistinct: true,
            }),
            ...t.primaryKey(['one', 'two'], { name: 'onePkey' }),
            ...t.check(t.sql`one = 69`),
            ...t.check(t.sql`one::text != two`, { name: 'tableCheck' }),
          }));
        },
      });

      await act();

      assert.tableFile([
        [
          'tables/one.table.ts',
          `import { BaseTable } from '../migrations.test-utils';

export class OneTable extends BaseTable {
  schema = 'schema';
  readonly table = 'one';
  columns = this.setColumns((t) => ({
    one: t.integer().check(t.sql\`(one = 69)\`),
    two: t.text(),
    snakeCase: t.name('snake_case').boolean(),
    numbers: t.enum('public.numbers', ['one', 'two']),
    domain: t.domain('public.domain').as(t.integer().nullable()),
    ...t.primaryKey(['one', 'two'], { name: 'onePkey' }),
    ...t.unique(['one', 'two'], {
      name: 'uniqueIdx',
      nullsNotDistinct: true,
    }),
    ...t.check(t.sql({ raw: '((one)::text <> two)' }), { name: 'tableCheck' }),
  }));
}
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
          `import { BaseTable } from '../migrations.test-utils';

export class OneTable extends BaseTable {
  readonly table = 'one';
  comment = 'table comment';
  noPrimaryKey = true;
  columns = this.setColumns((t) => ({
    column: t.text(),
  }));
}
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

          await db.createTable('two', (t) => ({
            three: t.integer().primaryKey(),
            four: t.text().primaryKey(),
            ...t.foreignKey(['three', 'four'], 'one', ['one', 'two'], {
              name: 'fkeyName',
            }),
          }));
        },
      });

      await act();

      assert.tableFile([
        [
          'tables/one.table.ts',
          `import { BaseTable } from '../migrations.test-utils';
import { TwoTable } from './two.table';

export class OneTable extends BaseTable {
  readonly table = 'one';
  columns = this.setColumns((t) => ({
    one: t.integer(),
    two: t.text(),
    ...t.primaryKey(['one', 'two']),
  }));
  
  relations = {
    two: this.belongsTo(() => TwoTable, {
      columns: ['one', 'two'],
      references: ['three', 'four'],
    }),
  };
}
`,
        ],
        [
          'tables/two.table.ts',
          `import { BaseTable } from '../migrations.test-utils';
import { OneTable } from './one.table';

export class TwoTable extends BaseTable {
  readonly table = 'two';
  columns = this.setColumns((t) => ({
    three: t.integer(),
    four: t.text(),
    ...t.primaryKey(['three', 'four']),
    ...t.foreignKey(
      ['three', 'four'],
      'one',
      ['one', 'two'],
      {
        name: 'fkeyName',
      },
    ),
  }));
  
  relations = {
    one: this.hasMany(() => OneTable, {
      columns: ['three', 'four'],
      references: ['one', 'two'],
    }),
  };
}
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
            await db.createExtension('cube', { version: '1.5' });
          },
        });

        await act();

        assert.dbFile([
          [
            path.resolve(testConfig.basePath, testConfig.dbPath as string),
            `import { orchidORM } from 'orchid-orm';

export const db = orchidORM({
  databaseURL: 'url',
  extensions: [{ cube: '1.5' }],
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
