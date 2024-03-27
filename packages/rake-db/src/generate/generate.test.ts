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
  AdapterOptions,
  ColumnsShape,
  DefaultColumnTypes,
  DefaultSchemaConfig,
  defaultSchemaConfig,
  getColumnTypes,
  getTableData,
  makeColumnTypes,
  TableData,
  UnknownColumn,
} from 'pqb';
import fs from 'fs/promises';
import { promptSelect } from '../prompt';

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

type ColumnTypes = DefaultColumnTypes<DefaultSchemaConfig>;
const t: ColumnTypes = makeColumnTypes(defaultSchemaConfig);

class BaseTable {
  schema?: string;
  types = t;
  tableData!: TableData;
  setColumns(fn: (t: ColumnTypes) => ColumnsShape) {
    const shape = getColumnTypes(t, fn, undefined, undefined);
    this.tableData = getTableData();
    return shape;
  }
}

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
}) => {
  config = {
    db: (() =>
      arg.tables
        ? Object.fromEntries(
            arg.tables.map((klass) => {
              const t = new klass();
              return [
                klass.name,
                Object.assign(t, {
                  internal: {
                    ...t.tableData,
                  },
                  q: {
                    schema: t.schema,
                  },
                }),
              ];
            }),
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
};

const act = () => generate(options, config);

const assert = {
  migration: (code: string) => {
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

    it('should only change table schema when both schemas exist', async () => {
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
              shape = this.setColumns((t) => ({
                name: t.string(),
                int: t.integer(),
                virtual: new UnknownColumn(defaultSchemaConfig),
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
            {
              schemaName: 'schema',
              name: 'one',
              comment: 'table comment',
              columns: [
                {
                  schemaName: 'schema',
                  tableName: 'one',
                  name: 'name',
                  type: 'varchar',
                  typeSchema: 'pg_catalog',
                  isArray: false,
                  maxChars: 255,
                  isNullable: false,
                },
                {
                  schemaName: 'schema',
                  tableName: 'one',
                  name: 'int',
                  type: 'int4',
                  typeSchema: 'pg_catalog',
                  isArray: false,
                  numericPrecision: 32,
                  numericScale: 0,
                  isNullable: false,
                },
              ],
            },
            {
              schemaName: 'public',
              name: 'schemaMigrations',
              columns: [
                {
                  schemaName: 'public',
                  tableName: 'schemaMigrations',
                  name: 'version',
                  type: 'text',
                  typeSchema: 'pg_catalog',
                  isArray: false,
                  isNullable: false,
                },
                {
                  schemaName: 'public',
                  tableName: 'schemaMigrations',
                  name: 'name',
                  type: 'text',
                  typeSchema: 'pg_catalog',
                  isArray: false,
                  isNullable: false,
                },
              ],
            },
          ],
          views: [],
          indexes: [
            {
              schemaName: 'schema',
              tableName: 'one',
              name: 'one_name_int_idx',
              using: 'btree',
              isUnique: false,
              columns: [{ column: 'name' }, { column: 'int' }],
              nullsNotDistinct: false,
            },
          ],
          constraints: [
            {
              schemaName: 'schema',
              tableName: 'one',
              name: 'one_check',
              check: { columns: ['int'], expression: '("int" > 5)' },
            },
            {
              schemaName: 'schema',
              tableName: 'one',
              name: 'one_pkey',
              primaryKey: ['name', 'int'],
            },
          ],
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
  });
});
