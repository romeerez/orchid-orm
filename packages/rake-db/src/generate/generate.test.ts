import { generate } from './generate';
import { testConfig } from '../rake-db.test-utils';
import { AnyRakeDbConfig } from 'rake-db';
import {
  DbStructure,
  introspectDbSchema,
  IntrospectedStructure,
} from './dbStructure';
import { asMock } from 'test-utils';
import { AdapterOptions } from 'pqb';
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

class BaseTable {
  schema?: string;
}

const defaultConfig = {
  ...testConfig,
  baseTable: BaseTable as AnyRakeDbConfig['baseTable'],
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

  describe('schema', () => {
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
});

change(async (db) => {
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

    it('should create new schema and drop old when selecting `create schema` option', async () => {
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

    it('should rename schema and set table schema when selecting `rename schema` option', async () => {
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

change(async (db) => {
  await db.changeTableSchema('one', 'from', 'to');
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
});

change(async (db) => {
  await db.changeTableSchema('one', 'from', 'to');
});

change(async (db) => {
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
});

change(async (db) => {
  await db.changeTableSchema('two', 'to', 'from');
});
`);
    });
  });
});
