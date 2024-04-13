import { generate } from './generate';
import { testConfig } from '../rake-db.test-utils';
import { AnyRakeDbConfig } from 'rake-db';
import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
} from './dbStructure';
import { asMock } from 'test-utils';
import {
  Adapter,
  AdapterOptions,
  defaultSchemaConfig,
  UnknownColumn,
} from 'pqb';
import fs from 'fs/promises';
import { promptSelect } from '../prompt';
import { dbStructureMockFactory } from './dbStructure.mockFactory';
import { ColumnsShapeBase, createBaseTable, orchidORM } from 'orchid-orm';

jest.mock('../generate/dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../prompt');

const defaultOptions: AdapterOptions[] = [
  { databaseURL: 'postgres://user@localhost/dbname' },
];
let options = defaultOptions;

const BaseTable = createBaseTable({
  columnTypes: (t) => ({
    ...t,
    text: (min = 0, max = Infinity) => t.text(min, max),
  }),
});

const defaultConfig = {
  ...testConfig,
  baseTable: BaseTable as unknown as AnyRakeDbConfig['baseTable'],
};
let config: AnyRakeDbConfig = defaultConfig;

const makeStructure = (
  arg: Partial<
    Omit<IntrospectedStructure, 'tables'> & {
      tables?: (Omit<DbStructure.Table, 'columns'> & {
        columns?: DbStructure.Column[];
      })[];
    }
  >,
): IntrospectedStructure => {
  return {
    schemas: [],
    views: [],
    indexes: [],
    constraints: [],
    triggers: [],
    extensions: [],
    enums: [],
    domains: [],
    collations: [],
    ...arg,
    tables: arg.tables?.map((t) => ({ ...t, columns: t.columns ?? [] })) ?? [],
  };
};

const arrange = (arg: {
  config?: AnyRakeDbConfig;
  options?: AdapterOptions[];
  structure?: IntrospectedStructure;
  structures?: IntrospectedStructure[];
  tables?: (typeof BaseTable)[];
  selects?: number[];
  compareExpressions?: boolean[];
}) => {
  config = {
    db: (() =>
      arg.tables
        ? orchidORM(
            { noPrimaryKey: 'ignore' },
            Object.fromEntries(arg.tables.map((klass) => [klass.name, klass])),
          )
        : {}) as unknown as AnyRakeDbConfig['db'],
    ...(arg.config ?? defaultConfig),
  };
  options = arg.options ?? defaultOptions;

  if (arg.structures) {
    for (const structure of arg.structures) {
      asMock(introspectDbSchema).mockResolvedValueOnce(structure);
    }
  } else {
    asMock(introspectDbSchema).mockResolvedValue(
      arg.structure ?? makeStructure({}),
    );
  }

  if (arg.selects) {
    for (const select of arg.selects) {
      asMock(promptSelect).mockResolvedValueOnce(select);
    }
  }

  const { compareExpressions } = arg;
  if (compareExpressions) {
    jest.spyOn(Adapter.prototype, 'arrays').mockImplementation(() =>
      Promise.resolve({
        rows: [compareExpressions],
        rowCount: 1,
        fields: [],
      }),
    );
  }
};

const act = () => generate(options, config);

const assert = {
  migration: (code?: string) => {
    expect(asMock(fs.writeFile).mock.calls[0]?.[1]).toBe(code);
  },
};

describe('generate', () => {
  beforeEach(jest.clearAllMocks);

  it('should throw if no `db` setting in the config', async () => {
    arrange({
      config: { ...defaultConfig, db: undefined },
    });

    await expect(act()).rejects.toThrow(
      '`db` setting must be set in the rake-db config for the generator to work',
    );
  });

  it('should throw if db options is empty', async () => {
    arrange({
      options: [],
    });

    await expect(act()).rejects.toThrow('Database options must not be empty');
  });

  it('should throw if table`s table is not set', async () => {
    arrange({
      tables: [class One extends BaseTable {}],
    });

    await expect(act()).rejects.toThrow(`Table One is missing table property`);
  });

  it('should throw if one db schema does not match the other', async () => {
    arrange({
      options: [
        { databaseURL: 'postgres://user@localhost/dbname' },
        { databaseURL: 'postgres://user@localhost/dbname-test' },
      ],
      structures: [
        makeStructure({ schemas: ['one'] }),
        makeStructure({ schemas: ['two'] }),
      ],
    });

    await expect(act()).rejects.toThrow(
      'schemas[0] in the db 0 does not match db 1',
    );
  });

  describe('schemas', () => {
    it('should create db schemas and set tables schemas', async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'one';
            table = 'one';
          },
          class Two extends BaseTable {
            schema = 'two';
            table = 'two';
          },
        ],
        structure: makeStructure({
          tables: [
            {
              schemaName: 'public',
              name: 'one',
            },
            {
              schemaName: 'public',
              name: 'two',
            },
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createSchema('one');

  await db.createSchema('two');
});

change(async (db) => {
  await db.changeTableSchema('one', 'public', 'one');

  await db.changeTableSchema('two', 'public', 'two');
});
`);
    });

    it('should drop a db schema, do not drop the public schema', async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'one';
            table = 'one';
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'one', 'two'],
          tables: [
            {
              schemaName: 'one',
              name: 'one',
            },
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropSchema('two');
});
`);
    });

    it('should create new schema and drop the old one when selecting `create schema` option', async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'to';
            table = 'one';
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'from'],
          tables: [
            {
              schemaName: 'to',
              name: 'one',
            },
          ],
        }),
        selects: [0],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createSchema('to');

  await db.dropSchema('from');
});
`);
    });

    it('should rename schema when selecting `rename schema` option', async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'to';
            table = 'one';
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'from'],
          tables: [{ schemaName: 'from', name: 'one' }],
        }),
        selects: [1],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
`);
    });

    it('should rename schema and drop other schema', async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'to';
            table = 'one';
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'drop', 'from'],
          tables: [
            {
              schemaName: 'from',
              name: 'one',
            },
          ],
        }),
        selects: [2],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');

  await db.dropSchema('drop');
});
`);
    });

    it('should change table schema when both schemas exist', async () => {
      arrange({
        tables: [
          class One extends BaseTable {
            schema = 'to';
            table = 'one';
          },
          class Two extends BaseTable {
            schema = 'from';
            table = 'two';
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'from', 'to'],
          tables: [
            {
              schemaName: 'from',
              name: 'one',
            },
            {
              schemaName: 'to',
              name: 'two',
            },
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTableSchema('one', 'from', 'to');

  await db.changeTableSchema('two', 'to', 'from');
});
`);
    });
  });

  describe('tables', () => {
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
          constraints: [
            dbStructureMockFactory.primaryKey({ tableName: 'one' }),
          ],
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

  describe('enums', () => {
    it('should create enum when creating a table', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            columns = this.setColumns((t) => ({
              id: t.identity().primaryKey(),
              numbers: t.enum('numbers', ['one', 'two', 'three']),
            }));
          },
        ],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createEnum('public.numbers', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.createTable('table', (t) => ({
    id: t.identity().primaryKey(),
    numbers: t.enum('numbers'),
  }));
});
`);
    });

    it('should drop unused enum', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            columns = this.setColumns((t) => ({
              id: t.identity().primaryKey(),
            }));
          },
        ],
        structure: makeStructure({
          schemas: ['public'],
          enums: [
            dbStructureMockFactory.enum({
              name: 'numbers',
              values: ['one', 'two', 'three'],
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.identityColumn({ name: 'id' }),
                dbStructureMockFactory.column({
                  typeSchema: 'public',
                  type: 'numbers',
                  name: 'numbers',
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    numbers: t.drop(t.enum('public.numbers')),
  }));
});

change(async (db) => {
  await db.dropEnum('public.numbers', ['one', 'two', 'three']);
});
`);
    });

    it('should change enum schema', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              numbers: t.enum('schema.numbers', ['one', 'two', 'three']),
            }));
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'schema'],
          enums: [
            dbStructureMockFactory.enum({
              name: 'numbers',
              values: ['one', 'two', 'three'],
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.column({
                  typeSchema: 'public',
                  type: 'numbers',
                  name: 'numbers',
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTypeSchema('numbers', 'public', 'schema');
});
`);
    });

    it('should drop the old and create a new enum after prompt', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.enum('to', ['one', 'two', 'three']),
            }));
          },
        ],
        structure: makeStructure({
          enums: [
            dbStructureMockFactory.enum({
              name: 'from',
              values: ['one', 'two', 'three'],
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.enumColumn({
                  type: 'from',
                  name: 'column',
                }),
              ],
            }),
          ],
        }),
        selects: [0],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createEnum('public.to', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.enum('public.from'), t.enum('public.to')),
  }));
});

change(async (db) => {
  await db.dropEnum('public.from', ['one', 'two', 'three']);
});
`);
    });

    it('should rename enum after prompt', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.enum('to', ['one', 'two', 'three']),
            }));
          },
        ],
        structure: makeStructure({
          enums: [
            dbStructureMockFactory.enum({
              name: 'from',
              values: ['one', 'two', 'three'],
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.enumColumn({
                  type: 'from',
                  name: 'column',
                }),
              ],
            }),
          ],
        }),
        selects: [1],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameType('from', 'to');
});
`);
    });

    it('should rename schema without touching enum', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.enum('to.enum', ['one', 'two', 'three']),
            }));
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'from'],
          enums: [
            dbStructureMockFactory.enum({
              schemaName: 'from',
              name: 'enum',
              values: ['one', 'two', 'three'],
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.enumColumn({
                  typeSchema: 'from',
                  type: 'enum',
                  name: 'column',
                }),
              ],
            }),
          ],
        }),
        selects: [1],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('from', 'to');
});
`);
    });

    describe('recreating and renaming both schema and enum', () => {
      const arrangeData = () => ({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.enum('toSchema.toEnum', ['one', 'two', 'three']),
            }));
          },
        ],
        structure: makeStructure({
          schemas: ['public', 'fromSchema'],
          enums: [
            dbStructureMockFactory.enum({
              schemaName: 'fromSchema',
              name: 'fromEnum',
              values: ['one', 'two', 'three'],
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.enumColumn({
                  typeSchema: 'fromSchema',
                  type: 'fromEnum',
                  name: 'column',
                }),
              ],
            }),
          ],
        }),
      });

      it('should recreate schema and enum', async () => {
        arrange({
          ...arrangeData(),
          selects: [0, 0],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createSchema('toSchema');
});

change(async (db) => {
  await db.createEnum('toSchema.toEnum', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.enum('fromSchema.fromEnum'), t.enum('toSchema.toEnum')),
  }));
});

change(async (db) => {
  await db.dropEnum('fromSchema.fromEnum', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.dropSchema('fromSchema');
});
`);
      });

      it('should recreate schema and rename enum', async () => {
        arrange({
          ...arrangeData(),
          selects: [0, 1],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.createSchema('toSchema');
});

change(async (db) => {
  await db.renameType('fromSchema.fromEnum', 'toSchema.toEnum');
});

change(async (db) => {
  await db.dropSchema('fromSchema');
});
`);
      });

      it('should rename schema and recreate enum', async () => {
        arrange({
          ...arrangeData(),
          selects: [1, 0],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('fromSchema', 'toSchema');
});

change(async (db) => {
  await db.createEnum('toSchema.toEnum', ['one', 'two', 'three']);
});

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.enum('toSchema.fromEnum'), t.enum('toSchema.toEnum')),
  }));
});

change(async (db) => {
  await db.dropEnum('toSchema.fromEnum', ['one', 'two', 'three']);
});
`);
      });

      it('should rename schema and enum', async () => {
        arrange({
          ...arrangeData(),
          selects: [1, 1],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.renameSchema('fromSchema', 'toSchema');
});

change(async (db) => {
  await db.renameType('toSchema.fromEnum', 'toSchema.toEnum');
});
`);
      });
    });

    describe('enum values', () => {
      const tableWithEnum = (values: [string, ...string[]]) =>
        class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns((t) => ({
            numbers: t.enum('numbers', values),
          }));
        };

      const dbWithEnum = (values: [string, ...string[]]) =>
        makeStructure({
          enums: [
            dbStructureMockFactory.enum({
              name: 'numbers',
              values,
            }),
          ],
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.enumColumn({
                  type: 'numbers',
                  name: 'numbers',
                }),
              ],
            }),
          ],
        });

      it('should add values to enum', async () => {
        arrange({
          tables: [tableWithEnum(['one', 'two', 'three'])],
          structure: dbWithEnum(['one']),
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.addEnumValues('public.numbers', ['two', 'three']);
});
`);
      });

      it('should drop values from enum', async () => {
        arrange({
          tables: [tableWithEnum(['one'])],
          structure: dbWithEnum(['one', 'two', 'three']),
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.dropEnumValues('public.numbers', ['two', 'three']);
});
`);
      });

      it('should recreate enum when values do not match', async () => {
        arrange({
          tables: [tableWithEnum(['three', 'four'])],
          structure: dbWithEnum(['one', 'two']),
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeEnumValues('public.numbers', ['one', 'two'], ['three', 'four']);
});
`);
      });

      it('should do nothing if enum was not changed', async () => {
        arrange({
          tables: [tableWithEnum(['one', 'two', 'three'])],
          structure: dbWithEnum(['one', 'two', 'three']),
        });

        await act();

        assert.migration();
      });
    });
  });

  describe('columns', () => {
    it('should add a column', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              id: t.identity(),
              name: t.text(),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [dbStructureMockFactory.identityColumn({ name: 'id' })],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.add(t.text()),
  }));
});
`);
    });

    it('should drop a column', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              id: t.identity(),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.identityColumn({ name: 'id' }),
                dbStructureMockFactory.textColumn({ name: 'name' }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.drop(t.text()),
  }));
});
`);
    });

    it('should change column type', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              name: t.text(),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [dbStructureMockFactory.intColumn({ name: 'name' })],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    name: t.change(t.integer(), t.text()),
  }));
});
`);
    });

    it('should change column type when type schema is changed', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.type('to.custom').as(t.integer()),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.column({
                  typeSchema: 'from',
                  type: 'custom',
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.type('from.custom'), t.type('to.custom')),
  }));
});
`);
    });

    it('should change text data type properties', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.varchar(20).collate('toCollation').compression('l'),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.column({
                  type: 'varchar',
                  maxChars: 10,
                  collation: 'fromCollation',
                  compression: 'p',
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.varchar(10).compression('p').collate('fromCollation'), t.varchar(20).compression('l').collate('toCollation')),
  }));
});
`);
    });

    it('change number data type properties', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.decimal(11, 13),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.column({
                  type: 'decimal',
                  numericPrecision: 3,
                  numericScale: 7,
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.decimal(3, 7), t.decimal(11, 13)),
  }));
});
`);
    });

    it('change date precision', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.timestamp(13),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.column({
                  type: 'timestamptz',
                  dateTimePrecision: 7,
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.timestamp(7), t.timestamp(13)),
  }));
});
`);
    });

    it('change default', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              valueNotChanged: t.integer().default(1),
              valueChanged: t.integer().default(3),
              ignoreFunction: t.integer().default(() => 1),
              sqlNotChanged: t.integer().default(t.sql`1 + 2`),
              sqlChanged: t.integer().default(t.sql`1 + 3`),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.intColumn({
                  name: 'valueNotChanged',
                  default: '1',
                }),
                dbStructureMockFactory.intColumn({
                  name: 'valueChanged',
                  default: '2',
                }),
                dbStructureMockFactory.intColumn({
                  name: 'ignoreFunction',
                }),
                dbStructureMockFactory.intColumn({
                  name: 'sqlNotChanged',
                  default: '(1 + 2)',
                }),
                dbStructureMockFactory.intColumn({
                  name: 'sqlChanged',
                  default: '(1 + 2)',
                }),
              ],
            }),
          ],
        }),
        compareExpressions: [false, false],
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    valueChanged: t.change(t.integer().default(t.sql({ raw: '2' })), t.integer().default(3)),
    sqlChanged: t.change(t.integer().default(t.sql({ raw: '(1 + 2)' })), t.integer().default(t.sql\`1 + 3\`)),
  }));
});
`);
    });

    it('change identity', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.identity({
                incrementBy: 2,
                startWith: 3,
                min: 4,
                max: 5,
                cache: 6,
                cycle: true,
                always: true,
              }),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.identityColumn({
                  name: 'column',
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.identity(), t.identity({
      always: true,
      incrementBy: 2,
      startWith: 3,
      min: 4,
      max: 5,
      cache: 6,
    })),
  }));
});
`);
    });

    it('change column comment', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.text().comment('to'),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.textColumn({
                  name: 'column',
                  comment: 'from',
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.text().comment('from'), t.text().comment('to')),
  }));
});
`);
    });

    it('change to array type', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.array(t.integer()),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [dbStructureMockFactory.intColumn()],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.integer(), t.array(t.integer())),
  }));
});
`);
    });

    it('change from array type', async () => {
      arrange({
        tables: [
          class Table extends BaseTable {
            table = 'table';
            noPrimaryKey = true;
            columns = this.setColumns((t) => ({
              column: t.integer(),
            }));
          },
        ],
        structure: makeStructure({
          tables: [
            dbStructureMockFactory.table({
              name: 'table',
              columns: [
                dbStructureMockFactory.intColumn({
                  isArray: true,
                }),
              ],
            }),
          ],
        }),
      });

      await act();

      assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    column: t.change(t.array(t.integer()), t.integer()),
  }));
});
`);
    });

    describe('recreating and renaming', () => {
      const table = (
        columns: (t: typeof BaseTable.columnTypes) => ColumnsShapeBase,
      ) => {
        return class Table extends BaseTable {
          table = 'table';
          noPrimaryKey = true;
          columns = this.setColumns(columns);
        };
      };

      const dbTable = dbStructureMockFactory.table({
        name: 'table',
        columns: [
          dbStructureMockFactory.intColumn({
            name: 'from',
          }),
        ],
      });

      it('should drop old and create new column when selected', async () => {
        arrange({
          tables: [
            table((t) => ({
              to: t.integer(),
            })),
          ],
          structure: makeStructure({
            tables: [dbTable],
          }),
          selects: [0],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    to: t.add(t.integer()),
    from: t.drop(t.integer()),
  }));
});
`);
      });

      it('should rename column when selected', async () => {
        arrange({
          tables: [
            table((t) => ({
              to: t.integer(),
            })),
          ],
          structure: makeStructure({
            tables: [dbTable],
          }),
          selects: [1],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    from: t.rename('to'),
  }));
});
`);
      });

      it('should rename column when using custom name', async () => {
        arrange({
          tables: [
            table((t) => ({
              from: t.name('to').integer(),
            })),
          ],
          structure: makeStructure({
            tables: [dbTable],
          }),
          selects: [1],
        });

        await act();

        assert.migration(`import { change } from '../src/dbScript';

change(async (db) => {
  await db.changeTable('table', (t) => ({
    from: t.rename('to'),
  }));
});
`);
      });
    });
  });
});
