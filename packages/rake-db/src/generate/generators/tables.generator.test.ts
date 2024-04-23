import { generatorsTestUtils } from './generators.test-utils';
import { defaultSchemaConfig, UnknownColumn } from 'pqb';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';

jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, BaseTable, makeStructure } = generatorsTestUtils;

describe('tables', () => {
  beforeEach(jest.clearAllMocks);

  it('should throw if found more than one table with same schema and name', async () => {
    arrange({
      tables: [
        class One extends BaseTable {
          schema = 'schema';
          table = 'table';
        },
        class Two extends BaseTable {
          schema = 'schema';
          table = 'table';
        },
      ],
    });

    await expect(act()).rejects.toThrow(
      `Table schema.table is defined more than once`,
    );
  });

  it(
    'should create table, ignore virtual column, add table comment, add noPrimaryKey option, ' +
      'add composite primary key, index, constraint',
    async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'schema';
            table = 'one';
            comment = 'table comment';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              name: t.string(),
              int: t.integer(),
              virtual: new UnknownColumn(defaultSchemaConfig),
              ...t.timestamps(),
              ...t.primaryKey(['name', 'int']),
              ...t.index(['name', 'int']),
              ...t.constraint({
                name: 'constraintName',
                check: t.sql`int > 5`,
              }),
            }));
          },
        ],
        structure: makeStructure({
          schemas: ['schema'],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

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
      ...t.timestamps(),
      ...t.primaryKey(['name', 'int']),
      ...t.index(['name', 'int']),
      ...t.check(t.sql\`int > 5\`),
    }),
  );
});
`);
    },
  );

  it('should drop table with same properties as when creating a table', async () => {
    arrange({
      structure: makeStructure({
        schemas: ['public', 'schema'],
        tables: [
          dbStructureMockFactory.table({
            schemaName: 'schema',
            name: 'one',
            comment: 'table comment',
            columns: [
              dbStructureMockFactory.varcharColumn({
                name: 'name',
              }),
              dbStructureMockFactory.intColumn({
                name: 'int',
              }),
              dbStructureMockFactory.timestampColumn({
                name: 'createdAt',
                default: 'now()',
              }),
              dbStructureMockFactory.timestampColumn({
                name: 'updatedAt',
                default: 'now()',
              }),
            ],
          }),
          dbStructureMockFactory.table({
            name: 'schemaMigrations',
          }),
        ],
        views: [],
        indexes: [
          dbStructureMockFactory.index({
            schemaName: 'schema',
            tableName: 'one',
            name: 'one_name_int_idx',
            columns: [{ column: 'name' }, { column: 'int' }],
          }),
        ],
        constraints: dbStructureMockFactory.constraints(
          { schemaName: 'schema', tableName: 'one' },
          [
            dbStructureMockFactory.check({
              name: 'one_check',
              check: { columns: ['int'], expression: '("int" > 5)' },
            }),
            dbStructureMockFactory.primaryKey({
              name: 'one_pkey',
              primaryKey: ['name', 'int'],
            }),
          ],
        ),
      }),
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropTable(
    'schema.one',
    {
      comment: "table comment",
    },
    (t) => ({
      name: t.varchar(255),
      int: t.integer().check(t.sql({ raw: '("int" > 5)' })),
      ...t.timestamps(),
      ...t.primaryKey(['name', 'int']),
      ...t.index(['name', 'int']),
    }),
  );
});

change(async (db) => {
  await db.dropSchema('schema');
});
`);
  });

  it('should create a new table and drop the old one when choosing such option', async () => {
    arrange({
      tables: [
        class Two extends BaseTable {
          table = 'two';
        },
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'one',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
        ],
        constraints: [dbStructureMockFactory.primaryKey({ tableName: 'one' })],
      }),
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createTable('two', (t) => ({}));

  await db.dropTable('one', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);
  });

  it('should create a new table and drop the old one when choosing such option, with schema', async () => {
    arrange({
      tables: [
        class Two extends BaseTable {
          schema = 'to';
          table = 'two';
        },
        class Unchanged extends BaseTable {
          schema = 'from';
          table = 'unchanged';
        },
      ],
      structure: makeStructure({
        schemas: ['public', 'from', 'to'],
        tables: [
          dbStructureMockFactory.table({
            schemaName: 'from',
            name: 'one',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
          dbStructureMockFactory.table({
            schemaName: 'from',
            name: 'unchanged',
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({
            schemaName: 'from',
            tableName: 'one',
          }),
        ],
      }),
      selects: [0],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createTable('to.two', (t) => ({}));

  await db.dropTable('from.one', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);
  });

  it('should rename table when is selected so, and drop the remaining table', async () => {
    arrange({
      tables: [
        class Three extends BaseTable {
          table = 'three';
        },
      ],
      structure: makeStructure({
        tables: [
          dbStructureMockFactory.table({
            name: 'one',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
          dbStructureMockFactory.table({
            name: 'two',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({ tableName: 'one' }),
          dbStructureMockFactory.primaryKey({ tableName: 'two' }),
        ],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameTable('one', 'three');

  await db.dropTable('two', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);
  });

  it('should rename table when is selected so, and drop the remaining table, with schema', async () => {
    arrange({
      tables: [
        class Three extends BaseTable {
          schema = 'to';
          table = 'three';
        },
        class Unchanged extends BaseTable {
          schema = 'from';
          table = 'unchanged';
        },
      ],
      structure: makeStructure({
        schemas: ['public', 'from', 'to'],
        tables: [
          dbStructureMockFactory.table({
            schemaName: 'from',
            name: 'one',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
          dbStructureMockFactory.table({
            schemaName: 'from',
            name: 'two',
            columns: [dbStructureMockFactory.intColumn({ name: 'id' })],
          }),
          dbStructureMockFactory.table({
            schemaName: 'from',
            name: 'unchanged',
          }),
        ],
        constraints: [
          dbStructureMockFactory.primaryKey({
            schemaName: 'from',
            tableName: 'one',
          }),
          dbStructureMockFactory.primaryKey({
            schemaName: 'from',
            tableName: 'two',
          }),
        ],
      }),
      selects: [1],
    });

    await act();

    assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameTable('from.one', 'to.three');

  await db.dropTable('from.two', (t) => ({
    id: t.integer().primaryKey(),
  }));
});
`);
  });

  describe('hasAndBelongsToMany', () => {
    const oneStructure = dbStructureMockFactory.table({
      name: 'one',
      columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
    });

    const twoStructure = dbStructureMockFactory.table({
      name: 'two',
      columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
    });

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

      arrange({
        tables: [One, Two],
        structure: makeStructure({
          tables: [oneStructure, twoStructure],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createTable('joinTable', (t) => ({
    oneId: t.integer(),
    twoId: t.integer(),
    ...t.primaryKey(['oneId', 'twoId']),
  }));
});
`);
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

      arrange({
        tables: [One, Two],
        structure: makeStructure({
          tables: [oneStructure, twoStructure],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createTable('joinTable', (t) => ({
    oneId: t.integer(),
    twoId: t.integer(),
    ...t.primaryKey(['oneId', 'twoId']),
  }));
});
`);
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

      arrange({
        tables: [One, Two],
        structure: makeStructure({
          tables: [oneStructure, twoStructure],
        }),
      });

      await expect(act()).rejects.toThrow('does not match');
    });
  });
});
