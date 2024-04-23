import { generatorsTestUtils } from './generators.test-utils';
import { dbStructureMockFactory } from '../dbStructure.mockFactory';

jest.mock('../dbStructure');
jest.mock('fs/promises', () => ({
  readdir: jest.fn(() => Promise.resolve([])),
  mkdir: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../prompt');

const { arrange, act, assert, table, makeStructure } = generatorsTestUtils;

describe('enums', () => {
  beforeEach(jest.clearAllMocks);

  it('should create enum when creating a table', async () => {
    arrange({
      tables: [
        table(
          (t) => ({
            id: t.identity().primaryKey(),
            numbers: t.enum('numbers', ['one', 'two', 'three']),
          }),
          false,
        ),
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
      tables: [table()],
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
        table((t) => ({
          numbers: t.enum('schema.numbers', ['one', 'two', 'three']),
        })),
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
        table((t) => ({
          column: t.enum('to', ['one', 'two', 'three']),
        })),
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
        table((t) => ({
          column: t.enum('to', ['one', 'two', 'three']),
        })),
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
        table((t) => ({
          column: t.enum('to.enum', ['one', 'two', 'three']),
        })),
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
        table((t) => ({
          column: t.enum('toSchema.toEnum', ['one', 'two', 'three']),
        })),
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
      table((t) => ({
        numbers: t.enum('numbers', values),
      }));

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
