import { useGeneratorsTestUtils } from './generators.test-utils';
import {
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  UnknownColumn,
} from 'pqb';
import { DbMigration, colors } from 'rake-db';

jest.mock('rake-db', () => ({
  ...jest.requireActual('../../../../../rake-db/src'),
  migrate: jest.fn(),
  promptSelect: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));

const { green, red, yellow } = colors;

describe('tables', () => {
  const { arrange, act, assert, BaseTable, table } = useGeneratorsTestUtils();

  it('should throw if found more than one table with same schema and name', async () => {
    await arrange({
      tables: [
        class One extends BaseTable {
          schema = 'schema';
          table = 'table';
          noPrimaryKey = true;
        },
        class Two extends BaseTable {
          schema = 'schema';
          table = 'table';
          noPrimaryKey = true;
        },
      ],
    });

    await expect(act()).rejects.toThrow(
      `Table schema.table is defined more than once`,
    );
  });

  it(
    'should create table with customly named timestamps, ignore virtual column, add table comment, add noPrimaryKey option, ' +
      'add composite primary key, index, constraint',
    async () => {
      await arrange({
        async prepareDb(db) {
          await db.createSchema('schema');
        },
        tables: [
          class One extends BaseTable {
            schema = 'schema';
            table = 'one';
            comment = 'table comment';
            noPrimaryKey = true;
            snakeCase = true;
            columns = this.setColumns(
              (t) => ({
                name: t.string(),
                int: t.integer(),
                virtual: new UnknownColumn(defaultSchemaConfig),
                created: t.timestamps().createdAt,
                updated: t.timestamps().updatedAt,
              }),
              (t) => [
                t.primaryKey(['name', 'int']),
                t.index(['name', 'int']),
                t.check(t.sql`int > 5`, 'constraintName'),
              ],
            );
          },
        ],
      });

      await act();

      assert.migration(
        `import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'schema.one',
    {
      comment: "table comment",
      noPrimaryKey: true,
    },
    (t) => ({
      name: t.string(),
      int: t.integer(),
      ` +
          // when creating, logic can see that `createdAt` and `updatedAt` are indeed coming from `timestamps` and can rely on this fact.
          `created: t.timestamps().createdAt,
      updated: t.timestamps().updatedAt,
    }),
    (t) => [
      t.primaryKey(['name', 'int']),
      t.index(['name', 'int']),
      t.check(t.sql\`int > 5\`, 'constraintName'),
    ],
  );
});
`,
      );

      assert.report(
        `${green('+ create table')} schema.one (4 columns, 1 index, 1 check)`,
      );
    },
  );

  it('should drop table with same properties as when creating a table', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('schema');

        await db.createTable(
          'schema.one',
          { comment: 'table comment', noPrimaryKey: true },
          (t) => ({
            name: t.varchar(255),
            int: t.integer().check(t.sql`("int" > 5)`),
            created: t.timestamps().createdAt,
            updated: t.timestamps().updatedAt,
          }),
          (t) => [t.primaryKey(['name', 'int']), t.index(['name', 'int'])],
        );
      },
    });

    await act();

    assert.migration(
      `import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.dropTable(
    'schema.one',
    {
      comment: "table comment",
    },
    (t) => ({
      name: t.varchar(255),
      int: t.integer().check(t.sql\`("int" > 5)\`),
      ` +
        // when dropping, the logic cannot know if it's from `timestamps` or if it's just an arbitrary timestamp.
        `created: t.timestamp().default(t.sql\`now()\`),
      updated: t.timestamp().default(t.sql\`now()\`),
    }),
    (t) => [
      t.primaryKey(['name', 'int']),
      t.index(['name', 'int']),
    ],
  );
});

change(async (db) => {
  await db.dropSchema('schema');
});
`,
    );

    assert.report(`${red('- drop schema')} schema
${red('- drop table')} schema.one (4 columns, 1 index, 1 check)`);
  });

  it('should create a new table and drop the old one when choosing such option', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('one', (t) => ({
          id: t.integer().primaryKey(),
        }));
      },
      tables: [
        class Two extends BaseTable {
          noPrimaryKey = true;
          table = 'two';
        },
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'two',
    {
      noPrimaryKey: true,
    },
    (t) => ({}),
  );

  await db.dropTable('one', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${green('+ create table')} two (0 columns, no primary key)`,
      `${red('- drop table')} one (1 column)`,
    );
  });

  it('should create a new table and drop the old one when choosing such option, with schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');
        await db.createSchema('to');

        await db.createTable('from.one', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('from.unchanged', { noPrimaryKey: true });
      },
      tables: [
        class Two extends BaseTable {
          noPrimaryKey = true;
          schema = 'to';
          table = 'two';
        },
        class Unchanged extends BaseTable {
          schema = 'from';
          table = 'unchanged';
          noPrimaryKey = true;
        },
      ],
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'to.two',
    {
      noPrimaryKey: true,
    },
    (t) => ({}),
  );

  await db.dropTable('from.one', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${green('+ create table')} to.two (0 columns, no primary key)`,
      `${red('- drop table')} from.one (1 column)`,
    );
  });

  it('should rename table when is selected so, and drop the remaining table', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('one', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('two', (t) => ({
          id: t.integer().primaryKey(),
        }));
      },
      tables: [
        table(
          (t) => ({
            id: t.integer().primaryKey(),
          }),
          undefined,
          { name: 'three' },
        ),
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameTable('one', 'three');

  await db.dropTable('two', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${yellow('~ rename table')} one ${yellow('=>')} three`,
      `${red('- drop table')} two (1 column)`,
    );
  });

  it('should rename table when is selected so, and drop the remaining table, with schema', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createSchema('from');
        await db.createSchema('to');

        await db.createTable('from.one', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('from.two', (t) => ({
          id: t.integer().primaryKey(),
        }));

        await db.createTable('from.unchanged', { noPrimaryKey: true });
      },
      tables: [
        class Three extends BaseTable {
          schema = 'to';
          table = 'three';
          columns = this.setColumns((t) => ({
            id: t.integer().primaryKey(),
          }));
        },
        class Unchanged extends BaseTable {
          schema = 'from';
          table = 'unchanged';
          noPrimaryKey = true;
        },
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameTable('from.one', 'to.three');

  await db.dropTable('from.two', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);

    assert.report(
      `${yellow('~ change schema and rename table')} from.one ${yellow(
        '=>',
      )} to.three`,
      `${red('- drop table')} from.two (1 column)`,
    );
  });

  it('should rename and change a table', async () => {
    await arrange({
      async prepareDb(db) {
        await db.createTable('from', (t) => ({
          id: t.integer().primaryKey(),
        }));
      },
      tables: [
        class Table extends BaseTable {
          table = 'to';
          columns = this.setColumns((t) => ({
            id: t.integer().primaryKey(),
            name: t.text(),
          }));
        },
      ],
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.renameTable('from', 'to');
});

change(async (db) => {
  await db.changeTable('to', (t) => ({
    name: t.add(t.text()),
  }));
});
`);

    assert.report(
      `${yellow('~ rename table')} from ${yellow('=>')} to`,
      `${yellow('~ change table')} to:`,
      `  ${green('+ add column')} name text`,
    );
  });

  describe('hasAndBelongsToMany', () => {
    const prepareDb = async (
      db: DbMigration<DefaultColumnTypes<DefaultSchemaConfig>>,
    ) => {
      await db.createTable('one', { noPrimaryKey: true }, (t) => ({
        id: t.identity(),
      }));
      await db.createTable('two', { noPrimaryKey: true }, (t) => ({
        id: t.identity(),
      }));
    };

    it('should create join table', async () => {
      class One extends BaseTable {
        table = 'one';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          id: t.identity(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => Two, {
            columns: ['id'],
            references: ['oneId'],
            through: {
              table: 'joinTable',
              columns: ['twoId'],
              references: ['id'],
            },
          }),
        };
      }

      class Two extends BaseTable {
        table = 'two';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          id: t.identity(),
        }));
      }

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'joinTable',
    (t) => ({
      oneId: t.integer(),
      twoId: t.integer(),
    }),
    (t) => t.primaryKey(['oneId', 'twoId']),
  );
});
`);

      assert.report(`${green('+ create table')} joinTable (2 columns)`);
    });

    it('should create join table just once when it is defined on both sides', async () => {
      class One extends BaseTable {
        table = 'one';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          id: t.identity(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => Two, {
            columns: ['id'],
            references: ['oneId'],
            through: {
              table: 'joinTable',
              columns: ['twoId'],
              references: ['id'],
            },
          }),
        };
      }

      class Two extends BaseTable {
        table = 'two';
        noPrimaryKey = true;
        columns = this.setColumns((t) => ({
          id: t.identity(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => One, {
            columns: ['id'],
            references: ['twoId'],
            through: {
              table: 'joinTable',
              columns: ['oneId'],
              references: ['id'],
            },
          }),
        };
      }

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await act();

      assert.migration(`import { change } from '../src/migrations/dbScript';

change(async (db) => {
  await db.createTable(
    'joinTable',
    (t) => ({
      oneId: t.integer(),
      twoId: t.integer(),
    }),
    (t) => t.primaryKey(['oneId', 'twoId']),
  );
});
`);

      assert.report(`${green('+ create table')} joinTable (2 columns)`);
    });

    it('should throw if two join table do not match', async () => {
      class One extends BaseTable {
        table = 'one';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => Two, {
            columns: ['id'],
            references: ['oneId'],
            through: {
              table: 'joinTable',
              columns: ['twoId'],
              references: ['id'],
            },
          }),
        };
      }

      class Two extends BaseTable {
        table = 'two';
        columns = this.setColumns((t) => ({
          id: t.identity().primaryKey(),
        }));
        relations = {
          twos: this.hasAndBelongsToMany(() => One, {
            columns: ['id'],
            references: ['wrong'],
            through: {
              table: 'joinTable',
              columns: ['oneId'],
              references: ['id'],
            },
          }),
        };
      }

      await arrange({
        prepareDb,
        tables: [One, Two],
      });

      await expect(act()).rejects.toThrow('does not match');
    });
  });
});
